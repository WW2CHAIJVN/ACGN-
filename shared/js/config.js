// ========== 全局配置 ==========
const CONFIG = {
    // 站点探测配置（浏览器本地直连，不经服务器）
    PROBE: {
        CONCURRENCY: 20,          // 滑动窗口并发，浏览器对同一域并发上限约 6，但跨多域可远高于此
        TIMEOUT: 3000,            // 短超时：可达站秒级响应，死站最多等 3s
        SERVER_CACHE_URL: 'php/probe_cache.php',  // 服务器共享缓存接口（同源）
        REPORT_ON_DONE: true      // 探测完成后把结果回传服务器，供其他用户复用
    },
    // 音乐播放器配置
    MUSIC: {
        API_URL: '/php/ncm_proxy.php',
        DEFAULT_BITRATE: 320,
        SEARCH_LIMIT: 30
    },
    // 侧边栏按钮配置
    SIDEBAR: {
        BUTTONS: [
            { text: '资源解压教学 & 分卷教学', type: 'link', url: 'class.html' },
            { text: 'CVE 技术归档', icon: 'edit_note', type: 'link', url: 'cve/' },
            { text: '直连区', type: 'scroll', target: 'direct-section' },
            { text: '海外区（需代理）', type: 'scroll', target: 'proxy-section' },
            { text: '失效/超时区', type: 'scroll', target: 'dead-section' },
            { text: '开发日志', icon: 'edit_note', type: 'link', url: 'devlog.html' },
            { text: '反馈与建议', icon: 'edit_note', type: 'player-feedback' },
            //{ text: '音频播放器', icon: 'queue_music', type: 'player' },
            { text: '声库下载', type: 'link', icon: 'download', url: 'SHULIKO/声库下载.html' }
        ]
    }
};

// ========== API 调用构造器（所有请求集中在这里改） ==========
const API = {
    // 搜索歌曲
    search: (keyword) => `${CONFIG.MUSIC.API_URL}?action=search&keyword=${encodeURIComponent(keyword)}`,
    // 获取播放地址
    songUrl: (id, br) => `${CONFIG.MUSIC.API_URL}?action=url&id=${id}&br=${br}`
};