// ========== 页面跳转退场过渡 ==========
// 在子页面（class、devlog、CVE、404）中使用
// 拦截所有站内链接点击，添加 .page-exit 退场动画后再跳转
(function() {
    let navTimer = null;

    document.addEventListener('click', function(e) {
        var link = e.target.closest('a[href]');
        if (!link) return;
        var href = link.getAttribute('href');
        if (!href || href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:')) return;
        if (link.target === '_blank') return;
        if (href.startsWith('http') && !href.startsWith(window.location.origin)) return;

        e.preventDefault();
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
