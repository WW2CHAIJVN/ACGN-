# ACGN 导航站

一个面向 ACGN（动漫 / 漫画 / 游戏 / 轻小说）领域的资源导航站。前端为原生 HTML/CSS/JS（Material Design 3 风格，基于 mdui v2），后端为无框架的 PHP 接口（无数据库，JSON 文件存储）。站点内置**在线探测**、**网易云音乐播放器**、**邮件反馈系统**等功能，并附带解压教学、CVE 技术归档、声库下载等子页面。

> 本项目为一个静态站点 + 少量 PHP 后端的整体，克隆后放到任意支持 PHP 的 Web 服务器即可运行，无需构建步骤、无需数据库。

---

## 功能特性

### 首页（index.html）
- **站点导航**：收录约 105 个 ACGN 资源站点，分为「直连区」「海外区（需代理）」「失效/超时区」三个分区，支持按分区筛选
- **站点在线探测**：
  - 浏览器端并发直连探测（并发 20、超时 3s），实时显示每个站点的在线状态与加载进度
  - 探测结果回传服务器共享缓存（`php/probe_cache.php`），其他用户首屏可直接看到缓存结果（缓存 6 小时，过期条目自动失效）
  - 后端提供 SSRF 防护的探测接口（`php/examine_URL.php`），支持状态检测与 favicon 获取
- **网易云音乐播放器**：搜索歌曲（上限 30 条）、选择音质（128k/192k/320k/无损）、播放/暂停/上下曲/进度条，支持最小化「灵动岛」悬浮模式；播放地址经 PHP 代理（`php/ncm_proxy.php`）中转，绕过前端 CORS 限制
- **反馈与建议**：资源分享 / Bug 反馈 / 功能建议 / CVE 安全 / 其他，五种类型，通过邮件送达站长（见「反馈系统」）
- **明暗主题切换**：Material Design 3 主题令牌，防 FOUC 闪烁，偏好持久化
- **双端适配**：
  - 桌面端：NASA 风格三层导航（topbar / masthead / mega-nav）+ 菊花链导航
  - 移动端：抽屉式侧边栏
  - 站内跳转附带页面过渡动画

### 子页面
| 页面 | 说明 |
| --- | --- |
| `class.html` | 解压教学 / 分卷合并教程（Android / Windows / iOS/macOS 三平台，含教学视频 `Video/`） |
| `devlog.html` | 开发日志，记录每次修复与迭代 |
| `cve/` | CVE 技术归档（自动化系统逻辑盲点研究，仅供学习）：`CVE-2016-3714` ImageTragick 命令执行、`CVE-2023-36584` Windows MOTW 标记绕过、`CVE-2026-0866` ZIP 格式解析漏洞 |
| `SHULIKO/声库下载.html` | 声库下载站（VOCALOID / A.I.Voice / Synthesizer V 等，内容源自 vcwiki.kdns.fr 分支） |
| `404.html` | 404 页面 |

---

## 技术栈

- **前端**：原生 HTML / CSS / JavaScript，无框架、无构建步骤
- **UI 组件库**：[mdui v2](https://www.mdui.org/)（Material Design 3），CDN 引入（unpkg）
- **CSS 架构**：设计令牌（`theme.css`）→ 重置 → 过渡 → 组件 → 页面，模块化加载，`?v=` 查询串做缓存版本号
- **后端**：PHP 7.4+（兼容 PHP < 8.1），无框架，单文件接口
- **存储**：无数据库，JSON 文件（`cache/probe_cache.json`）
- **部署**：Nginx / Apache + PHP-FPM，无需伪静态规则

---

## 目录结构

```
acgn/
├── index.html              # 主页：导航 + 探测 + 音乐播放器 + 反馈
├── class.html              # 解压教学 / 分卷合并
├── devlog.html             # 开发日志
├── 404.html
├── desktop/                # 桌面端布局
│   ├── css/layout.css      #   三层导航 + 菊花链导航样式
│   └── js/desktop-nav.js   #   桌面端导航初始化
├── mobile/                 # 移动端布局
│   ├── css/layout.css      #   抽屉导航样式
│   └── js/sidebar.js       #   侧边栏逻辑
├── shared/                 # 共享资源（主题 / 组件 / 页面样式）
│   ├── css/
│   │   ├── theme.css       #   MD3 设计令牌（颜色 / 圆角 / 阴影）
│   │   ├── reset.css       #   样式重置
│   │   ├── transitions.css #   页面过渡动画
│   │   ├── components.css  #   通用组件
│   │   ├── components/     #   feedback / music 等组件
│   │   └── pages/          #   class / cve / devlog / 404 等页面样式
│   └── js/
│       ├── config.js       #   全局配置（探测 / 音乐 / 侧边栏）
│       ├── sites.js        #   站点数据（direct / proxy / dead 三区）
│       ├── probe.js        #   站点探测逻辑
│       ├── music.js        #   音乐播放器
│       ├── feedback.js     #   反馈弹窗
│       ├── theme.js        #   主题切换（提前执行防 FOUC）
│       └── main.js         #   主入口
├── php/                    # 后端接口
│   ├── ncm_proxy.php       #   网易云音乐 API 代理（搜索 / 播放地址）
│   ├── probe_cache.php     #   探测结果共享缓存（读 / 写）
│   ├── examine_URL.php     #   站点状态 / favicon 探测（含 SSRF 防护）
│   ├── send_feedback.php   #   反馈邮件发送（AES 加密授权码）
│   └── get_last_error.php  #   后端最近错误查询（调试用，同源限制）
├── cve/                    # CVE 技术归档
├── SHULIKO/                # 声库下载站
├── Video/                  # 解压教学视频
├── cache/                  # 运行时缓存（已 gitignore，不入库）
├── .user.ini               # PHP open_basedir 配置
└── .htaccess
```

---

## 快速开始 / 部署

### 环境要求
- Web 服务器（Nginx / Apache）+ PHP **7.4 及以上**（推荐 8.x）
- PHP 扩展：`curl`、`openssl`、`mbstring`（JSON 为内置扩展）
- `cache/` 目录需对 Web 运行用户可写（探测共享缓存、反馈限流文件存储于此）

### 部署步骤
1. 将项目文件放入 Web 根目录（如 `/www/wwwroot/acgn`），保持目录结构不变
2. 确保 `cache/` 可写：`chown www:www cache && chmod 755 cache`
3. 无需配置伪静态；`index.html` 即为首页

### 反馈系统部署（可选）
反馈邮件依赖 SMTP 授权码，采用「密文 / 密钥 / IV 三元组分离」存储：

1. 在 **webroot 之外**（如 `/www/server_config/`）创建密钥文件 `.smtp_key.env`，格式：

   ```
   CIPHER_B64=<授权码的 AES-256-CBC 密文(base64)>
   KEY_HEX=<32 字节密钥(hex)>
   IV_HEX=<16 字节 IV(hex)>
   ```

2. 修改 `php/send_feedback.php` 顶部的 `$env_path` 指向该文件
3. 设置文件权限为 `0600`（权限过宽时脚本会拒绝使用并记入错误日志）

> 授权码加密生成示例（一行 PHP）：
> `openssl_encrypt($plain, 'AES-256-CBC', $key, OPENSSL_RAW_DATA, $iv)` 后分别 base64 / bin2hex。

### 站点数据维护
- 新增 / 修改站点：编辑 `shared/js/sites.js` 中 `direct` / `proxy` / `dead` 三个数组
- 新增子页面：复用 `desktop/css/layout.css` 的 `sub-topbar` / `sub-masthead` 头部结构，样式放入 `shared/css/pages/`

### 缓存版本号约定
静态资源统一使用 `?v=` 查询串做缓存控制（如 `?v=md3-8`）。修改 CSS/JS 后请**递增版本号**，否则浏览器可能命中旧缓存。

---

## 后端接口

| 接口 | 方法 | 参数 | 说明 |
| --- | --- | --- | --- |
| `php/ncm_proxy.php` | GET | `action=search&keyword=…` | 搜索网易云歌曲，返回 `[{id, name, artist, duration}]`（上限 30 条） |
| `php/ncm_proxy.php` | GET | `action=url&id=…&br=320000` | 获取歌曲播放地址，返回 `{url}`；`br` 白名单：128000/192000/320000/999000 |
| `php/examine_URL.php` | GET | `url=…&type=status\|icon` | 站点状态探测 / favicon 获取（含 SSRF 防护，禁止内网地址） |
| `php/probe_cache.php` | GET | `action=read` | 读取探测缓存快照（6 小时内有效） |
| `php/probe_cache.php` | POST | `action=write` + 探测结果 | 合并用户探测结果（单次 ≤2000 条，同 IP 5s 冷却） |
| `php/send_feedback.php` | POST | `type/contact/content` | 发送反馈邮件（IP+UA 指纹限流：30 分钟 10 次，超限冷却 1 小时） |
| `php/get_last_error.php` | GET | — | 查询后端最近错误（调试用；仅允许同源访问） |

---

## 安全设计

- **SSRF 防护**（`examine_URL.php`）：仅允许 http/https 协议、禁止 IP 字面量（含 IPv6）、解析域名后校验是否指向私有 / 保留地址
- **SMTP 授权码保护**（`send_feedback.php`）：授权码 AES-256-CBC 加密，密文/密钥/IV 分离存储于 webroot 之外；解密仅在内存中进行，明文不落盘；密钥文件权限过宽时拒绝使用
- **反馈防滥用**：IP + User-Agent 设备指纹限流（30 分钟 10 次，超限冷却 1 小时）；内容拒绝含 URL 的提交（防垃圾外链）
- **输入校验**：`ncm_proxy.php` 对 action 白名单、songId 强制整数、bitrate 白名单、keyword 长度限制
- **同源限制**：`get_last_error.php` 校验 Origin，禁止第三方网站读取错误信息
- **错误信息不泄露内部细节**：反馈接口对外统一返回模糊提示，具体原因只写入服务端错误日志
- **代码注释约定**：生产环境应保持 `CURLOPT_SSL_VERIFYPEER = true`（当前为兼容自签名环境默认关闭，如生产环境启用 HTTPS 请改回 `true`）

---

## 免责声明

- 本站为**导航站**，仅提供站点链接聚合，不存储任何资源文件；链接指向的第三方站点内容与本站无关
- 声库下载页（`SHULIKO/`）资源仅供学习研究使用，请遵守页面内标注的使用限制
- CVE 归档内容仅用于安全技术学习，请勿用于非法用途
- 探测结果仅供参考，站点状态可能随网络环境变化
