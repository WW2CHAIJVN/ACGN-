// ========== 站点探测模块（浏览器本地直连，服务器零带宽探测） ==========
// 速度优化三板斧：
//   1. img + no-cors fetch 并行竞速（Promise.any），任一成功即判可达；
//      死站也只需等一个超时周期，可达站几百毫秒出结果。
//   2. 短超时（3s）+ 高并发（20），整站几秒跑完。
//   3. 三级缓存秒出首屏：本地缓存 → 服务器缓存 → 无；探测后回传服务器供他人复用。

let siteList = [];
let probes = {};
let isProbing = false;

const CACHE_KEY = 'acgn_probe_cache_v1';
const CACHE_TTL = 6 * 60 * 60 * 1000;        // 缓存视为有效的最长期限：6 小时
const STALE_THRESHOLD = 30 * 60 * 1000;      // 30 分钟内探测过 → 不自动重测

function initSiteList() {
    siteList = [];
    SITES.direct.forEach(s => siteList.push({ ...s, category: 'direct', alive: null, iconBase64: null }));
    SITES.proxy.forEach(s => siteList.push({ ...s, category: 'proxy', alive: null, iconBase64: null }));
    SITES.dead.forEach(s => siteList.push({ ...s, category: 'dead', alive: null, iconBase64: null }));
}

// ---------- 本地缓存 ----------
function loadLocalCache() {
    try {
        const raw = localStorage.getItem(CACHE_KEY);
        if (!raw) return null;
        const data = JSON.parse(raw);
        return (data && typeof data === 'object') ? data : null;
    } catch { return null; }
}

function saveLocalCache(obj) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(obj)); } catch {}
}

// 把一份缓存对象（url -> {alive,icon,ts}）应用到 siteList/probes
function applyCacheObj(cacheObj) {
    if (!cacheObj) return 0;
    const now = Date.now();
    let hit = 0;
    for (const site of siteList) {
        if (site.category === 'proxy') continue;
        const c = cacheObj[site.url];
        if (c && (now - (c.ts || 0)) <= CACHE_TTL) {
            probes[site.url] = { alive: c.alive, error: null };
            site.alive = c.alive;
            site.iconBase64 = c.icon || null;
            site.category = c.alive ? 'direct' : 'dead';
            hit++;
        }
    }
    return hit;
}

// 本地缓存应用到页面，返回是否命中
function applyLocalCache() {
    return applyCacheObj(loadLocalCache()) > 0;
}

// 整批缓存的最新探测时间是否足够新（在 STALE_THRESHOLD 内）
function localCacheFreshEnough() {
    const cache = loadLocalCache();
    if (!cache) return false;
    const entries = Object.values(cache);
    if (!entries.length) return false;
    const newest = Math.max(...entries.map(e => e.ts || 0));
    return (Date.now() - newest) < STALE_THRESHOLD;
}

// ---------- 服务器共享缓存 ----------
async function fetchServerCache() {
    try {
        const res = await fetch(`${CONFIG.PROBE.SERVER_CACHE_URL}?action=read`, { cache: 'no-store' });
        if (!res.ok) return null;
        const data = await res.json();
        return (data && data.results && typeof data.results === 'object') ? data.results : null;
    } catch { return null; }
}

// 把探测结果回传服务器(合并到全局共享缓存,供其他用户复用)
async function reportToServer(resultsObj) {
    if (!CONFIG.PROBE.REPORT_ON_DONE) return;
    // 精简 payload:剔除 icon 为 null 的字段,减少传输体积
    const slim = {};
    for (const url in resultsObj) {
        const r = resultsObj[url];
        slim[url] = r.icon ? { alive: r.alive, icon: r.icon, ts: r.ts }
                           : { alive: r.alive, ts: r.ts };
    }
    try {
        await fetch(`${CONFIG.PROBE.SERVER_CACHE_URL}?action=write`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ results: slim })
        });
    } catch { /* 回传失败不影响本地功能 */ }
}

// ---------- 探测 ----------
function getOrigin(url) {
    try { return new URL(url).origin; } catch { return null; }
}
function getHost(url) {
    try { return new URL(url).host; } catch { return null; }
}

/**
 * 安全获取主机名（防御性包装）
 * 若 URL 无效则返回原始字符串或空值，避免 render() 中 new URL() 抛异常阻断渲染
 */
function safeHostname(url) {
    try { return new URL(url).hostname; } catch { return ''; }
}

// favicon 候选路径列表:依次尝试,第一个加载成功就用
// 1. /favicon.ico(最常见)
// 2. /favicon.png(不少站用 png)
// 3. /favicon.svg(现代站)
// 4. Google S2 服务(跨域友好,几乎万能,作为兜底)
function getFaviconCandidates(url) {
    const origin = getOrigin(url);
    const host = getHost(url);
    if (!origin || !host) return [];
    return [
        `${origin}/favicon.ico`,
        `${origin}/favicon.png`,
        `${origin}/favicon.svg`,
        `https://www.google.com/s2/favicons?sz=64&domain=${host}`
    ];
}

// 加载单张图片:成功(且是真图片)→ resolve(src);否则 reject
function loadImage(src, timeout) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        let settled = false;
        const timer = setTimeout(() => {
            if (settled) return;
            settled = true;
            img.onload = img.onerror = null;
            img.src = '';
            reject(new Error('timeout'));
        }, timeout);
        img.onload = () => {
            if (settled) return;
            settled = true; clearTimeout(timer);
            img.onload = img.onerror = null;
            // naturalWidth===0 说明响应不是真图片(如 HTML 错误页)
            if (img.naturalWidth > 0 || img.naturalHeight > 0) {
                img.src = '';   // 释放已解码的图片位图内存
                resolve(src);
            } else {
                img.src = '';
                reject(new Error('not image'));
            }
        };
        img.onerror = () => {
            if (settled) return;
            settled = true; clearTimeout(timer);
            img.onload = img.onerror = null;
            img.src = '';
            reject(new Error('error'));
        };
        img.src = src;
    });
}

// 依次尝试候选 favicon:任一成功即返回;全部失败才 reject
async function probeViaImage(url, timeout) {
    const candidates = getFaviconCandidates(url);
    if (!candidates.length) throw new Error('bad url');
    for (const src of candidates) {
        try {
            const ok = await loadImage(src, timeout);
            return ok;   // 返回加载成功的图标 URL
        } catch { /* 试下一个 */ }
    }
    throw new Error('all favicons failed');
}

// no-cors HEAD：成功 → resolve(true)；失败/超时 → reject
function probeViaFetch(url, timeout) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    return fetch(url, { mode: 'no-cors', method: 'HEAD', signal: controller.signal, cache: 'no-store' })
        .then(() => { clearTimeout(timer); return true; })
        .catch(e => { clearTimeout(timer); throw e; });
}

// 单站点：img 与 fetch 并行竞速，任一成功即判可达（img 成功还顺带拿到图标）
function probeSite(url) {
    const timeout = CONFIG.PROBE.TIMEOUT;
    const imgP = probeViaImage(url, timeout).then(icon => ({ alive: true, icon }));
    const fetchP = probeViaFetch(url, timeout).then(() => ({ alive: true, icon: null }));
    return Promise.any([imgP, fetchP])
        .then(r => ({ alive: true, error: null, icon: r.icon || null }))
        .catch(() => ({ alive: false, error: '不可达' }));   // 全部 reject = 不可达
}

// ---------- 主流程 ----------
async function startProbe(silent = false) {
    if (isProbing) return;
    // 防御:如果 siteList 为空(bootProbe 未成功初始化),此处自愈
    if (!siteList.length) initSiteList();
    if (!siteList.length) {
        // SITES 数据本身缺失,无法探测
        showAlert('站点数据加载失败,请刷新页面', 'error');
        return;
    }
    isProbing = true;
    const btn = document.getElementById('refreshBtn');
    const progressContainer = document.getElementById('progressContainer');
    const progressFill = document.getElementById('probeProgressFill');
    const progressText = document.getElementById('progressText');
    btn.disabled = true;
    btn.textContent = '探测中 0%';
    progressContainer.style.display = 'block';
    progressFill.style.width = '0%';
    progressText.innerText = '0 / ' + siteList.length;

    // 注意：不清空 site.alive/iconBase64 —— 保留当前显示（可能是缓存值），
    // 探测中页面保持不变，避免闪烁；全部完成后一次性重新分类渲染。
    probes = {};
    const total = siteList.length;
    let completed = 0;
    const updateProgress = () => {
        const percent = Math.round((completed / total) * 100);
        btn.textContent = `探测中 ${percent}%`;
        progressFill.style.width = (completed / total) * 100 + '%';
        progressText.innerText = completed + ' / ' + total;
    };

    // 用 try/finally 包裹探测主循环，确保任何异常都能恢复 UI 状态，
    // 避免按钮卡在 disabled 或进度条残留。
    try {
        // 滑动窗口并发：worker 拿完一个立即取下一个，可达站秒级释放 worker
        const CONCURRENCY = CONFIG.PROBE.CONCURRENCY;
        const queue = siteList.slice();
        const newCache = {};
        const workers = Array.from({ length: CONCURRENCY }, async () => {
            while (queue.length) {
                const site = queue.shift();
                if (site.category === 'proxy') {
                    probes[site.url] = { alive: true, error: null };
                    site.alive = true;
                    completed++; updateProgress();
                    continue;
                }
                const result = await probeSite(site.url);
                probes[site.url] = { alive: result.alive, error: result.error };
                site.alive = result.alive;
                if (result.alive && result.icon) site.iconBase64 = result.icon;
                newCache[site.url] = { alive: result.alive, icon: result.icon || null, ts: Date.now() };
                completed++; updateProgress();
            }
        });
        await Promise.all(workers);

        // 探测完成：本地缓存合并保存 + 回传服务器供他人复用
        const mergedLocal = { ...(loadLocalCache() || {}), ...newCache };
        saveLocalCache(mergedLocal);
        reportToServer(newCache);   // 异步回传，不阻塞 UI

        for (const site of siteList) {
            if (site.category === 'proxy') continue;
            const status = probes[site.url];
            if (!status) continue;
            site.category = status.alive ? 'direct' : 'dead';
        }
        renderWithTransition();
        if (!silent) showAlert('探测完成，已更新分类', 'success');
    } catch (err) {
        // 探测中途出错:尽量用已收集的结果渲染,并提示用户
        console.error('探测过程出错:', err);
        for (const site of siteList) {
            if (site.category === 'proxy') continue;
            const status = probes[site.url];
            if (status) site.category = status.alive ? 'direct' : 'dead';
        }
        renderWithTransition();
        if (!silent) showAlert('探测中断,已显示部分结果', 'error');
    } finally {
        // 无论成功失败,都恢复按钮与进度条状态
        isProbing = false;
        btn.disabled = false;
        btn.textContent = '⟳ 探测站点';
        progressContainer.style.display = 'none';
    }
}

// ---------- 首屏启动 ----------
async function bootProbe() {
    // initSiteList 必须最先执行且独立保护——它是 siteList 的唯一数据源,
    // 若失败则后面所有逻辑都无意义,但不能让它的异常阻断页面渲染。
    try {
        initSiteList();
    } catch (e) {
        console.error('initSiteList 失败:', e);
        showAlert('站点数据加载失败,请刷新页面', 'error');
        return;
    }
    if (!siteList.length) {
        showAlert('站点数据为空,请刷新页面', 'error');
        return;
    }

    // 用 try/catch 包裹后续异步流程,任何环节报错都不影响首屏渲染。
    // 即使缓存读取/网络拉取失败,也要保证页面能正常显示并响应用户操作。
    try {
        // 1) 优先用本地缓存秒出首屏
        const localHit = applyLocalCache();
        render();

        if (localHit && localCacheFreshEnough()) {
            // 本地缓存足够新，无需任何网络请求
            return;
        }

        // 2) 本地缓存缺失或过期：拉取服务器共享缓存
        //    若服务器缓存比本地新，则更新本地并重新渲染
        const serverCache = await fetchServerCache();
        if (serverCache) {
            const localCache = loadLocalCache() || {};
            let updated = false;
            for (const url in serverCache) {
                const s = serverCache[url];
                const l = localCache[url];
                if (!l || (s.ts || 0) > (l.ts || 0)) {
                    localCache[url] = s;
                    updated = true;
                }
            }
            if (updated) {
                saveLocalCache(localCache);
                applyCacheObj(localCache);
                renderWithTransition();
            }
            // 服务器缓存是否足够新 → 决定要不要再后台探测
            const entries = Object.values(serverCache);
            if (entries.length) {
                const newest = Math.max(...entries.map(e => e.ts || 0));
                if ((Date.now() - newest) < STALE_THRESHOLD) return;   // 服务器有新鲜数据，不必再探测
            }
        }

        // 3) 本地和服务器都没有新鲜数据 → 后台探测刷新
        //    首次访客(无任何旧结果可见)用非静默模式,让用户看到进度条;
        //    已有旧结果显示的回访用户用静默模式,避免打扰。
        const hasAnyDisplay = localHit || !!serverCache;
        startProbe(!hasAnyDisplay);
    } catch (e) {
        // 异步流程出错:首屏已渲染(用缓存或空状态),不阻断用户交互
        console.error('bootProbe 异步流程出错:', e);
    }
}

function renderWithTransition() {
    const container = document.getElementById('categories');
    container.style.opacity = '0';
    setTimeout(() => { render(); container.style.opacity = '1'; }, 150);
}

// 事件委托：在 #categories 上只绑定一次，渲染后无需再逐个绑定
let _renderDelegateBound = false;
function bindRenderDelegate() {
    if (_renderDelegateBound) return;
    _renderDelegateBound = true;
    document.getElementById('categories').addEventListener('click', function(e) {
        const card = e.target.closest('.link-card');
        if (!card) return;
        e.preventDefault();
        const url = card.getAttribute('data-url');
        if (url) window.open(url, '_blank');
    });
}

function render() {
    const container = document.getElementById('categories');
    bindRenderDelegate();
    const categories = [
        { key: 'direct', title: '直连区', sites: siteList.filter(s => s.category === 'direct'), className: 'direct' },
        { key: 'proxy', title: '海外区（需代理）', sites: siteList.filter(s => s.category === 'proxy'), className: 'proxy' },
        { key: 'dead', title: '失效/超时区', sites: siteList.filter(s => s.category === 'dead'), className: 'dead' }
    ];
    let html = '';
    for (const cat of categories) {
        if (cat.sites.length === 0) continue;
        html += `<div id="${cat.key}-section" class="category ${cat.className}">
                    <div class="category-title">${cat.title}<span class="category-count">${cat.sites.length}</span></div>
                    <div class="link-list">`;
        for (const site of cat.sites) {
            const status = probes[site.url];
            let statusHtml = '<div class="status-badge">未测</div>';
            if (status && status.error) statusHtml = `<div class="status-badge ${status.error === '连接超时' ? 'timeout' : 'error'}">${escapeHtml(status.error)}</div>`;
            else if (status && status.alive !== undefined) statusHtml = `<div class="status-badge ${status.alive ? 'alive' : 'dead'}">${status.alive ? '可达' : '不可达'}</div>`;
            // iconBase64 现存的是 favicon 的 URL（img 标签可直接跨域加载显示）
            const iconHtml = site.iconBase64 ? `<img src="${escapeHtml(site.iconBase64)}" alt="" referrerpolicy="no-referrer" loading="lazy">` : icon('link');
            // 卡片结构:图标(leading) + 信息(flex:1) + 状态徽章(trailing 右对齐)
            html += `<a href="${escapeHtml(site.url)}" class="link-card" data-url="${escapeHtml(site.url)}" target="_blank">
                        <div class="link-icon">${iconHtml}</div>
                        <div class="link-info">
                            <div class="link-name">${escapeHtml(site.name)}</div>
                            <div class="link-url">${escapeHtml(safeHostname(site.url))}</div>
                        </div>
                        ${statusHtml}
                    </a>`;
        }
        html += `</div></div>`;
    }
    container.innerHTML = html;
}

// 记录 showAlert 定时器，页面卸载时统一清除
const _alertTimers = new Set();

function showAlert(message, type = 'error') {
    const alertArea = document.getElementById('alertArea');
    if (!alertArea) return;
    alertArea.innerHTML = `<div class="alert-message ${type}">${escapeHtml(message)}</div>`;
    const timer = setTimeout(() => { if (alertArea.innerHTML.includes(message)) alertArea.innerHTML = ''; }, 7000);
    _alertTimers.add(timer);
    timer._isAlertTimer = true;
}

// 页面卸载时清理所有 pending 定时器
window.addEventListener('beforeunload', function() {
    _alertTimers.forEach(t => clearTimeout(t));
    _alertTimers.clear();
});

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m]));
}
