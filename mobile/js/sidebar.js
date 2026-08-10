// ========== 侧边栏模块 ==========
// v3: 增强动画 - 遮罩淡入淡出、按钮逐个入场、页面跳转退场过渡
//     兼容子页面:data-root 路径适配、scroll 按钮按目标存在性过滤

function initSidebar() {
    const menuBtn = document.getElementById('menuBtn');
    const mask = document.getElementById('sidebarMask');
    const sidebar = document.getElementById('sidebar');
    const navContainer = document.getElementById('sidebarNav');

    // 子页面通过 <body data-root="../"> 声明站点根路径前缀;
    // 首页无此属性,root 为空串,行为与原版一致
    var root = (document.body.dataset.root || '').replace(/\/+$/, '');
    root = root ? root + '/' : '';

    // 页面跳转带退场动画
    function navigateTo(url) {
        var exitTargets = document.querySelector('.container') || document.querySelector('.page-container') || document.body;
        exitTargets.classList.add('page-exit');
        // 关闭侧边栏
        sidebar.classList.remove('open');
        mask.classList.remove('active');
        setTimeout(function() {
            window.location.href = root + url;
        }, 200);
    }

    CONFIG.SIDEBAR.BUTTONS.forEach(function(btn, index) {
        // scroll 类型按钮:目标元素不存在(子页面无 direct-section 等)则跳过
        if (btn.type === 'scroll' && btn.target && !document.getElementById(btn.target)) {
            return;
        }
        var btnEl = document.createElement('button');
        btnEl.className = 'sidebar-btn';
        // 为按钮设置逐个入场的 stagger index
        btnEl.style.setProperty('--stagger-index', index);
        // 带 icon 的按钮:SVG 图标 + 文本;纯文本按钮保持原样
        btnEl.innerHTML = btn.icon ? icon(btn.icon) + ' <span>' + btn.text + '</span>' : btn.text;

        if (btn.type === 'link') {
            btnEl.onclick = function() {
                navigateTo(btn.url);
            };
        } else if (btn.type === 'player') {
            btnEl.onclick = function() {
                sidebar.classList.remove('open');
                mask.classList.remove('active');
                if (window.openMusicPlayer) window.openMusicPlayer();
            };
        } else if (btn.type === 'player-feedback') {
            btnEl.onclick = function() {
                sidebar.classList.remove('open');
                mask.classList.remove('active');
                if (typeof openFeedback === 'function') openFeedback();
            };
        } else {
            btnEl.onclick = function() {
                sidebar.classList.remove('open');
                mask.classList.remove('active');
                setTimeout(function() {
                    var target = document.getElementById(btn.target);
                    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }, 350);
            };
        }

        navContainer.appendChild(btnEl);
    });

    menuBtn.onclick = function() {
        sidebar.classList.add('open');
        mask.classList.add('active');
    };

    mask.onclick = function() {
        sidebar.classList.remove('open');
        mask.classList.remove('active');
    };
}
