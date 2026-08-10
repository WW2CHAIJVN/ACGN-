// ========== 主入口 ==========

// 全局：站内链接跳转退场动画
(function() {
    let navTimer = null;

    document.addEventListener('click', function(e) {
        var link = e.target.closest('a[href]');
        if (!link) return;
        // 只处理站内链接（同源 + 非 # 锚点 + 非 javascript:）
        var href = link.getAttribute('href');
        if (!href || href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:')) return;
        // 如果有 target="_blank" 则跳过
        if (link.target === '_blank') return;
        // 只处理 .html 链接或相对路径
        if (href.startsWith('http') && !href.startsWith(window.location.origin)) return;
        
        e.preventDefault();
        // 找到主容器并添加退场动画
        var container = document.querySelector('.container') || document.querySelector('.page-container') || document.body;
        container.classList.add('page-exit');
        navTimer = setTimeout(function() {
            window.location.href = href;
        }, 200);
    });

    // 页面卸载时清理导航定时器
    window.addEventListener('beforeunload', function() {
        if (navTimer) { clearTimeout(navTimer); navTimer = null; }
    });
})();

document.getElementById('refreshBtn').addEventListener('click', () => startProbe(false));
bootProbe();        // 首屏：有缓存先秒出，无缓存/过期后台静默探测
initSidebar();
initTheme();        // 主题切换按钮绑定(主题本身已在 theme.js 加载时尽早应用)