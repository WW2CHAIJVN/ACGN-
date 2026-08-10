// ========== 主题切换模块(亮 / 暗 / 自动 三态) ==========
// 与 mdui 主题类联动:
//   light → <html class="mdui-theme-light">
//   dark  → <html class="mdui-theme-dark">
//   auto  → <html class="mdui-theme-auto">(跟随系统 prefers-color-scheme)
// 主题令牌(--md-* 与 mdui 变量)定义在 css/theme.css。
// 切换按钮的 class/index.css 样式驱动,本模块只管状态。

const THEME_KEY = 'acgn_theme_mode';      // 存储用户选择:light/dark/auto
const THEMES = ['light', 'dark', 'auto']; // 循环顺序:亮 → 暗 → 自动 → 亮...
// 图标用内联 SVG(Material Symbols 路径),因 theme.js 在 head 早于 icons.js 加载,
// 故直接内联路径,不依赖 ICONS 全局。fill=currentColor 自适应亮/暗主题。
const THEME_META = {
    light: {
        label: '亮色', mduiClass: 'mdui-theme-light',
        svg: '<svg class="md-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58a.996.996 0 0 0-1.41 0 .996.996 0 0 0 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L5.99 4.58zm12.37 12.37a.996.996 0 0 0-1.41 0 .996.996 0 0 0 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0a.996.996 0 0 0 0-1.41l-1.06-1.06zm1.06-10.96a.996.996 0 0 0 0-1.41.996.996 0 0 0-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06zM7.05 18.36a.996.996 0 0 0 0-1.41.996.996 0 0 0-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06z"/></svg>'
    },
    dark: {
        label: '暗色', mduiClass: 'mdui-theme-dark',
        svg: '<svg class="md-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3a9 9 0 1 0 9 9c0-.46-.04-.92-.1-1.36a5.389 5.389 0 0 1-4.4 2.26 5.403 5.403 0 0 1-3.14-9.8c-.44-.06-.9-.1-1.36-.1z"/></svg>'
    },
    auto: {
        label: '跟随系统', mduiClass: 'mdui-theme-auto',
        svg: '<svg class="md-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M21 2H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h7l-2 3v1h8v-1l-2-3h7c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H3V4h18v12z"/></svg>'
    }
};

// 应用指定主题:设置 <html> 上的 mdui 类,同步切换按钮图标
function applyTheme(mode) {
    const meta = THEME_META[mode];
    if (!meta) return;
    const html = document.documentElement;
    // 移除所有主题类,再添加当前的
    html.classList.remove('mdui-theme-light', 'mdui-theme-dark', 'mdui-theme-auto');
    html.classList.add(meta.mduiClass);
    // 更新切换按钮的图标(按钮 id 在 index.html 中定义)
    const btn = document.getElementById('themeToggleBtn');
    if (btn) {
        btn.innerHTML = meta.svg;
        btn.title = `主题: ${meta.label}(点击切换)`;
    }
}

// 获取当前主题(优先 localStorage,默认 auto)
function getCurrentTheme() {
    const saved = localStorage.getItem(THEME_KEY);
    return THEMES.includes(saved) ? saved : 'auto';
}

// 切换到下一个主题(三态循环)
function cycleTheme() {
    const current = getCurrentTheme();
    const idx = THEMES.indexOf(current);
    const next = THEMES[(idx + 1) % THEMES.length];
    localStorage.setItem(THEME_KEY, next);
    applyTheme(next);
}

// 标记是否已绑定过点击事件,防止重复绑定
let _themeBound = false;

// 绑定主题切换按钮
function bindThemeToggle() {
    if (_themeBound) return;
    const btn = document.getElementById('themeToggleBtn');
    if (btn) {
        btn.addEventListener('click', cycleTheme);
        _themeBound = true;
    }
}

// 初始化主题:在 DOM 就绪时应用存储的主题,绑定切换按钮
function initTheme() {
    // 应用保存的主题(或默认 auto)
    applyTheme(getCurrentTheme());

    // 尝试绑定切换按钮(如果按钮已存在)
    bindThemeToggle();

    // 如果按钮还不存在(theme.js 在 head 中早于 body 加载),
    // 则在 DOMContentLoaded 后再绑定一次
    if (!_themeBound) {
        document.addEventListener('DOMContentLoaded', function () {
            bindThemeToggle();
        });
    }

    // 事件委托兜底:无论按钮何时出现,点击都有反应
    // 注意:如果按钮已通过 addEventListener 绑定,则此处不重复触发,避免连切两级
    document.addEventListener('click', function (e) {
        if (_themeBound) return;
        // 检查 target 是否是 #themeToggleBtn 或其内部元素
        let target = e.target;
        while (target && target !== document) {
            if (target.id === 'themeToggleBtn') {
                cycleTheme();
                break;
            }
            target = target.parentElement;
        }
    });

    // 监听系统主题变化:仅在 auto 模式下响应
    if (window.matchMedia) {
        const mql = window.matchMedia('(prefers-color-scheme: dark)');
        const handler = (e) => {
            if (getCurrentTheme() === 'auto') {
                // mdui-theme-auto 会自动跟随,无需手动改类;
                // 但 --md-* 变量由 theme.css 的 @media 处理,也无需 JS 干预。
                // 这里仅刷新按钮图标状态(图标不变,但可在此扩展提示)
            }
        };
        // 兼容旧版 Safari 的 addListener
        if (mql.addEventListener) mql.addEventListener('change', handler);
        else if (mql.addListener) mql.addListener(handler);
    }
}

// 防止主题闪烁(FOUC):在 CSS/HTML 加载前尽早应用主题
// 此函数在 theme.js 引入时立即执行(不等 DOMContentLoaded)
applyTheme(getCurrentTheme());
