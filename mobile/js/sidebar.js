// ========== 侧边栏模块 ==========
// v4: 桌面端常驻左侧导航栏(可折叠/展开,localStorage 持久化)
//     移动端维持抽屉式交互
//     兼容子页面:data-root 路径适配、scroll 按钮按目标存在性过滤

// 持久化 key(与 theme.js 的 acgn_theme_mode 同前缀风格)
const SIDEBAR_KEY = 'acgn_sidebar_collapsed';

function isDesktop() {
    return window.matchMedia('(min-width: 1024px)').matches;
}

function initSidebar() {
    const menuBtn = document.getElementById('menuBtn');
    const mask = document.getElementById('sidebarMask');
    const sidebar = document.getElementById('sidebar');
    const navContainer = document.getElementById('sidebarNav');

    // 子页面通过 <body data-root="../"> 声明站点根路径前缀;
    // 首页无此属性,root 为空串,行为与原版一致
    var root = (document.body.dataset.root || '').replace(/\/+$/, '');
    root = root ? root + '/' : '';

    // ---------- 桌面端常驻态:折叠/展开 ----------
    function applySidebarState() {
        if (!isDesktop()) {
            // 移动端:清除桌面常驻类,回归抽屉模式
            sidebar.classList.remove('collapsed');
            document.body.classList.remove('sidebar-collapsed');
            return;
        }
        var collapsed = localStorage.getItem(SIDEBAR_KEY) === '1';
        sidebar.classList.toggle('collapsed', collapsed);
        document.body.classList.toggle('sidebar-collapsed', collapsed);
    }

    // 尽早应用,减少布局闪烁
    applySidebarState();

    // ---------- 页面跳转带退场动画 ----------
    function navigateTo(url) {
        var exitTargets = document.querySelector('.container') || document.querySelector('.page-container') || document.body;
        exitTargets.classList.add('page-exit');
        // 移动端关闭抽屉;桌面端常驻不动
        if (!isDesktop()) {
            sidebar.classList.remove('open');
            mask.classList.remove('active');
        }
        setTimeout(function() {
            window.location.href = root + url;
        }, 200);
    }

    // ---------- 渲染侧边栏按钮 ----------
    CONFIG.SIDEBAR.BUTTONS.forEach(function(btn, index) {
        // scroll 类型按钮:目标元素不存在(子页面无 direct-section 等)则跳过
        if (btn.type === 'scroll' && btn.target && !document.getElementById(btn.target)) {
            return;
        }
        var btnEl = document.createElement('button');
        btnEl.className = 'sidebar-btn';
        btnEl.title = btn.text;   // 悬停显示完整文字(折叠态尤其有用)
        if (!btn.icon) btnEl.classList.add('no-icon');  // 标记无图标按钮
        // 为按钮设置逐个入场的 stagger index(移动端用)
        btnEl.style.setProperty('--stagger-index', index);
        // 统一用 span 包裹文字,便于桌面端折叠态隐藏文字只留图标;
        // 无 icon 的按钮文字始终可见(折叠态由 CSS 处理)
        var iconHtml = btn.icon ? icon(btn.icon) : '';
        btnEl.innerHTML = iconHtml + ' <span>' + btn.text + '</span>';

        if (btn.type === 'link') {
            btnEl.onclick = function() {
                navigateTo(btn.url);
            };
        } else if (btn.type === 'player') {
            btnEl.onclick = function() {
                if (!isDesktop()) {
                    sidebar.classList.remove('open');
                    mask.classList.remove('active');
                }
                if (window.openMusicPlayer) window.openMusicPlayer();
            };
        } else if (btn.type === 'player-feedback') {
            btnEl.onclick = function() {
                if (!isDesktop()) {
                    sidebar.classList.remove('open');
                    mask.classList.remove('active');
                }
                if (typeof openFeedback === 'function') openFeedback();
            };
        } else {
            btnEl.onclick = function() {
                if (!isDesktop()) {
                    sidebar.classList.remove('open');
                    mask.classList.remove('active');
                }
                setTimeout(function() {
                    var target = document.getElementById(btn.target);
                    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }, isDesktop() ? 0 : 350);
            };
        }

        navContainer.appendChild(btnEl);
    });

    // ---------- menuBtn 点击:桌面端折叠/展开,移动端打开抽屉 ----------
    menuBtn.onclick = function() {
        if (isDesktop()) {
            // 桌面端:切换折叠态并持久化
            var collapsed = !sidebar.classList.contains('collapsed');
            sidebar.classList.toggle('collapsed', collapsed);
            document.body.classList.toggle('sidebar-collapsed', collapsed);
            localStorage.setItem(SIDEBAR_KEY, collapsed ? '1' : '0');
        } else {
            // 移动端:打开抽屉
            sidebar.classList.add('open');
            mask.classList.add('active');
        }
    };

    // ---------- 移动端遮罩关闭 ----------
    mask.onclick = function() {
        sidebar.classList.remove('open');
        mask.classList.remove('active');
    };

    // ---------- 跨断点响应:窗口在 1024px 阈值附近变化时重新应用 ----------
    var mql = window.matchMedia('(min-width: 1024px)');
    var handleBreakpoint = function() { applySidebarState(); };
    if (mql.addEventListener) {
        mql.addEventListener('change', handleBreakpoint);
    } else if (mql.addListener) {
        mql.addListener(handleBreakpoint);
    }
}
