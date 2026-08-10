// ========== 桌面端 NASA 风格 Mega Menu 导航 ==========
// 在 >= 1024px 时初始化三层导航结构：
//   topbar → masthead → mega-nav + mega-panel
// Mega Menu 在 hover 导航项时展开，显示三列分组链接。
(function () {
    // ---------- 工具函数 ----------
    function isDesktop() {
        return window.matchMedia('(min-width: 1024px)').matches;
    }

    // 安全获取 icon SVG（icons.js 可能尚未加载时返回空字符串）
    function ico(name) {
        if (typeof icon === 'function') return icon(name);
        return '';
    }

    // 从 CONFIG.SIDEBAR.BUTTONS 中按文本模糊匹配按钮
    function findBtn(keyword) {
        if (!window.CONFIG || !CONFIG.SIDEBAR || !CONFIG.SIDEBAR.BUTTONS) return null;
        return CONFIG.SIDEBAR.BUTTONS.find(function (b) {
            return b.text && b.text.indexOf(keyword) !== -1;
        });
    }

    // ---------- 分组配置（与 CONFIG.SIDEBAR.BUTTONS 关联） ----------
    // 三列分组：快速访问 / 资源 / 更多
    function getMegaMenuGroups() {
        // 首页按钮（CONFIG 中没有，单独构造）
        var homeBtn = { text: '首页', type: 'link', url: 'index.html', icon: 'radar' };
        // 从 CONFIG 中读取各按钮
        var playerBtn = findBtn('音频播放器');
        var classBtn = findBtn('资源解压');
        var cveBtn = findBtn('CVE');
        var devlogBtn = findBtn('开发日志');
        var feedbackBtn = findBtn('反馈');

        // "探测站点" —— 用直连区作为代表，或构造一个综合入口
        var probeBtn = findBtn('直连区') || { text: '探测站点', type: 'scroll', target: 'direct-section' };
        // 如果是直连区，把文字改成"探测站点"更符合分组语义
        var probeItem = probeBtn ? Object.assign({}, probeBtn, { text: '探测站点' }) : null;

        return [
            {
                title: '快速访问',
                items: [homeBtn, playerBtn].filter(Boolean)
            },
            {
                title: '资源',
                items: [probeItem, classBtn].filter(Boolean)
            },
            {
                title: '更多',
                items: [cveBtn, devlogBtn, feedbackBtn].filter(Boolean)
            }
        ];
    }

    // 主导航项（从 CONFIG.SIDEBAR.BUTTONS 中筛选主要页面入口）
    function getNavItems() {
        var homeBtn = { text: '首页', type: 'link', url: 'index.html' };
        var classBtn = findBtn('资源解压');
        var cveBtn = findBtn('CVE');
        var devlogBtn = findBtn('开发日志');
        var playerBtn = findBtn('音频播放器');
        return [homeBtn, classBtn, cveBtn, devlogBtn, playerBtn].filter(Boolean);
    }

    // ---------- 点击动作 ----------
    function handleClick(btn) {
        if (!btn) return;
        if (btn.type === 'link' && btn.url) {
            // 页面跳转 + 退场动画
            var exitTargets = document.querySelector('.container') || document.querySelector('.page-container') || document.body;
            exitTargets.classList.add('page-exit');
            setTimeout(function () { window.location.href = btn.url; }, 200);
        } else if (btn.type === 'player') {
            if (typeof openMusicPlayer === 'function') openMusicPlayer();
        } else if (btn.type === 'player-feedback') {
            if (typeof openFeedback === 'function') openFeedback();
        } else if (btn.type === 'scroll' && btn.target) {
            var target = document.getElementById(btn.target);
            if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    // ---------- 判断当前页面是否匹配 ----------
    function isActive(btn) {
        if (!btn) return false;
        if (btn.type === 'link' && btn.url) {
            var path = window.location.pathname;
            // 首页特殊判断
            if (btn.url === 'index.html' || btn.url === './' || btn.url === '/') {
                return path.endsWith('/index.html') || path.endsWith('/') ||
                    (!path.endsWith('.html') && !path.includes('/cve/') && !path.includes('/devlog') && !path.includes('/class'));
            }
            return path.indexOf(btn.url) !== -1;
        }
        return false;
    }

    // ---------- 构建 topbar（顶部细条） ----------
    function buildTopbar() {
        var topbar = document.getElementById('topbar');
        if (!topbar) return;
        topbar.innerHTML =
            '<div class="topbar-inner">' +
            '<span class="topbar-brand">ACGN NAV</span>' +
            '<div class="topbar-links">' +
            '<a href="index.html">首页</a>' +
            '<span class="topbar-sep">|</span>' +
            '<a href="class.html">资源教学</a>' +
            '<span class="topbar-sep">|</span>' +
            '<a href="cve/">CVE 归档</a>' +
            '<span class="topbar-sep">|</span>' +
            '<a href="devlog.html">开发日志</a>' +
            '</div>' +
            '<span class="topbar-date" id="topbarDate"></span>' +
            '</div>';
        updateTopbarDate();
    }

    function updateTopbarDate() {
        var el = document.getElementById('topbarDate');
        if (!el) return;
        var now = new Date();
        var y = now.getFullYear();
        var m = String(now.getMonth() + 1).padStart(2, '0');
        var d = String(now.getDate()).padStart(2, '0');
        var weekDays = ['日', '一', '二', '三', '四', '五', '六'];
        el.textContent = y + '-' + m + '-' + d + ' 周' + weekDays[now.getDay()];
    }

    // ---------- 构建 masthead（中间标识区） ----------
    function buildMasthead() {
        var masthead = document.getElementById('masthead');
        if (!masthead) return;
        masthead.innerHTML =
            '<div class="masthead-inner">' +
            '<div class="masthead-logo">' +
            '<svg class="md-icon md-icon-lg" viewBox="0 0 24 24" fill="currentColor">' +
            '<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-2-5.5l4-2.5-4-2.5z"/>' +
            '</svg>' +
            '</div>' +
            '<div class="masthead-title">' +
            '<h1>ACGN 导航站</h1>' +
            '<p class="masthead-subtitle">探索 · 发现 · 分享</p>' +
            '</div>' +
            '<div class="masthead-spacer"></div>' +
            '<div class="masthead-tag">' +
            '<span class="status-dot online"></span>' +
            '<span>系统在线</span>' +
            '</div>' +
            '</div>';
    }

    // ---------- 构建 mega-nav（主导航条） ----------
    var _hoverTimer = null;

    function buildMegaNav() {
        var megaNav = document.getElementById('megaNav');
        if (!megaNav) return;
        megaNav.innerHTML = '';

        var items = getNavItems();
        var groups = getMegaMenuGroups();

        items.forEach(function (btn) {
            var btnEl = document.createElement('button');
            btnEl.className = 'mega-nav-item';
            if (isActive(btn)) btnEl.classList.add('active');
            btnEl.innerHTML =
                '<span class="mega-nav-label">' + btn.text + '</span>' +
                '<span class="mega-nav-arrow">▾</span>';

            // 点击 → 执行动作
            btnEl.addEventListener('click', function (e) {
                e.preventDefault();
                handleClick(btn);
                hideMegaPanel();
            });

            // hover → 展开 Mega Menu
            btnEl.addEventListener('mouseenter', function () {
                clearTimeout(_hoverTimer);
                showMegaPanel(groups, btnEl);
            });

            megaNav.appendChild(btnEl);
        });

        // 鼠标离开导航条时延迟关闭
        megaNav.addEventListener('mouseleave', function () {
            _hoverTimer = setTimeout(hideMegaPanel, 150);
        });
    }

    // ---------- 构建 mega-panel（Mega Menu 面板） ----------
    function showMegaPanel(groups, triggerEl) {
        var panel = document.getElementById('megaPanel');
        if (!panel) return;

        panel.innerHTML = '<div class="mega-panel-inner">' +
            groups.map(function (group) {
                return '<div class="mega-panel-col">' +
                    '<h4 class="mega-panel-title">' + group.title + '</h4>' +
                    '<ul class="mega-panel-list">' +
                    group.items.map(function (item) {
                        var iconHtml = item.icon ? ico(item.icon) : '';
                        return '<li>' +
                            '<a href="javascript:void(0)" class="mega-panel-link" data-text="' + item.text + '">' +
                            iconHtml +
                            '<span class="mega-panel-link-text">' + item.text + '</span>' +
                            '</a>' +
                            '</li>';
                    }).join('') +
                    '</ul>' +
                    '</div>';
            }).join('') +
            '</div>';

        // 绑定面板内链接点击
        var links = panel.querySelectorAll('.mega-panel-link');
        links.forEach(function (link) {
            var text = link.getAttribute('data-text');
            var item = findItemByText(groups, text);
            if (item) {
                link.addEventListener('click', function (e) {
                    e.preventDefault();
                    handleClick(item);
                    hideMegaPanel();
                });
            }
        });

        // 定位面板（与导航条左对齐）
        var megaNav = document.getElementById('megaNav');
        if (megaNav) {
            var rect = megaNav.getBoundingClientRect();
            panel.style.left = rect.left + 'px';
            panel.style.width = rect.width + 'px';
        }

        panel.style.display = 'block';
        // 触发过渡动画
        requestAnimationFrame(function () {
            panel.classList.add('open');
        });

        // 面板内也保持打开
        panel.onmouseenter = function () { clearTimeout(_hoverTimer); };
        panel.onmouseleave = function () {
            _hoverTimer = setTimeout(hideMegaPanel, 150);
        };
    }

    function hideMegaPanel() {
        var panel = document.getElementById('megaPanel');
        if (!panel) return;
        panel.classList.remove('open');
        setTimeout(function () {
            if (!panel.classList.contains('open')) {
                panel.style.display = 'none';
            }
        }, 200);
    }

    // 在分组中查找对应文字的按钮
    function findItemByText(groups, text) {
        for (var i = 0; i < groups.length; i++) {
            for (var j = 0; j < groups[i].items.length; j++) {
                if (groups[i].items[j].text === text) return groups[i].items[j];
            }
        }
        return null;
    }

    // ---------- 构建状态条 ----------
    function buildStatusBar() {
        var statusBar = document.getElementById('statusBar');
        if (!statusBar) return;
        statusBar.innerHTML =
            '<div class="status-bar-inner">' +
            '<span class="status-item"><span class="status-dot online"></span> 系统在线</span>' +
            '<span class="status-item" id="statusDate"></span>' +
            '<span class="status-spacer"></span>' +
            '<span class="status-item">ACGN NAV v2.0</span>' +
            '</div>';
        updateStatusDate();
    }

    function updateStatusDate() {
        var el = document.getElementById('statusDate');
        if (!el) return;
        var now = new Date();
        el.textContent = now.toLocaleString('zh-CN', {
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit',
            hour12: false
        });
    }

    // ---------- 初始化与重建 ----------
    var _initialized = false;
    var _dateTimer = null;

    function buildAll() {
        if (!isDesktop()) {
            // 移动端：清空内容
            var ids = ['topbar', 'masthead', 'megaNav', 'megaPanel', 'statusBar'];
            ids.forEach(function (id) {
                var el = document.getElementById(id);
                if (el) el.innerHTML = '';
            });
            if (_dateTimer) { clearInterval(_dateTimer); _dateTimer = null; }
            _initialized = false;
            return;
        }

        buildTopbar();
        buildMasthead();
        buildMegaNav();
        buildStatusBar();
        _initialized = true;

        // 日期时间每秒刷新
        if (!_dateTimer) {
            _dateTimer = setInterval(function () {
                updateTopbarDate();
                updateStatusDate();
            }, 1000);
        }
    }

    // 等待 DOM 就绪 + CONFIG 可用
    function tryInit() {
        var topbar = document.getElementById('topbar');
        if (!topbar || !window.CONFIG || !CONFIG.SIDEBAR || !CONFIG.SIDEBAR.BUTTONS) {
            return false;
        }
        buildAll();
        return true;
    }

    // 立即尝试
    if (!tryInit()) {
        // DOMContentLoaded 后再试
        document.addEventListener('DOMContentLoaded', function () {
            if (!tryInit()) {
                // 如果 CONFIG 还没加载，延迟一小会儿再试
                setTimeout(tryInit, 100);
            }
        });
    }

    // 窗口大小变化时重建
    var mql = window.matchMedia('(min-width: 1024px)');
    var handleResize = function () {
        // 防抖
        clearTimeout(window._navResizeTimer);
        window._navResizeTimer = setTimeout(buildAll, 150);
    };
    if (mql.addEventListener) {
        mql.addEventListener('change', handleResize);
    } else {
        mql.addListener(handleResize);
    }
    window.addEventListener('resize', handleResize);

    // 点击页面其他区域关闭 Mega Menu
    document.addEventListener('click', function (e) {
        var megaNav = document.getElementById('megaNav');
        var megaPanel = document.getElementById('megaPanel');
        if (!megaNav || !megaPanel) return;
        if (!megaNav.contains(e.target) && !megaPanel.contains(e.target)) {
            hideMegaPanel();
        }
    });
})();
