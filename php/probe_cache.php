<?php
// ========== 服务器端共享探测缓存 ==========
// 目的：让用户主动探测的结果回流到服务器，供其他用户首屏直接展示，
//       实现「即使不主动探测也能看到探测结果」。
//
// 存储：单文件 JSON（cache/probe_cache.json），站点级别足够用。
// 读写：GET action=read 返回最新快照；POST action=write 合并最新结果。
//
// 安全：仅合并已知字段的扁平对象，限制单次写入条数与体积，避免滥用。

session_start();
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: null');          // 同源调用，无需跨域
header('Cache-Control: no-store');

define('CACHE_DIR',  __DIR__ . '/../cache');
define('CACHE_FILE', CACHE_DIR . '/probe_cache.json');
define('MAX_ENTRIES', 2000);       // 单次写入最多合并条数，防止超大 payload
define('MAX_AGE',     6 * 3600);   // 6 小时：超过此年龄的条目视为过期，不再信任
define('WRITE_COOLDOWN', 5);       // 同一 IP 两次写入间隔至少 5 秒，防刷

// ---------- 工具 ----------

/**
 * IP 写入频率限制：同一 IP 在 WRITE_COOLDOWN 秒内只能写入一次
 * 防止恶意脚本高频刷写导致 IO 压力和缓存膨胀
 */
function checkWriteRateLimit() {
    $ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
    $key = 'probe_write_' . md5($ip);
    $last = $_SESSION[$key] ?? 0;
    $now = time();
    if (($now - $last) < WRITE_COOLDOWN) {
        return false;
    }
    $_SESSION[$key] = $now;
    return true;
}
function ensureCacheDir() {
    if (!is_dir(CACHE_DIR)) { @mkdir(CACHE_DIR, 0755, true); }
}

function readCacheRaw() {
    if (!is_file(CACHE_FILE)) return null;
    $raw = @file_get_contents(CACHE_FILE);
    if ($raw === false) return null;
    $data = json_decode($raw, true);
    return (is_array($data) && isset($data['results'])) ? $data : null;
}

function writeCacheRaw($data) {
    ensureCacheDir();
    // 原子写：先写临时文件再 rename，避免并发半截写入
    $tmp = CACHE_FILE . '.tmp.' . getmypid();
    if (@file_put_contents($tmp, json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)) === false) {
        @unlink($tmp); return false;
    }
    return @rename($tmp, CACHE_FILE);
}

function sendJson($obj) {
    echo json_encode($obj, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

// ---------- 读：返回最新快照（自动剔除过期条目） ----------
function doRead() {
    $cache = readCacheRaw();
    if (!$cache) sendJson(['ts' => 0, 'count' => 0, 'results' => new stdClass()]);

    $now = time();
    $results = isset($cache['results']) && is_array($cache['results']) ? $cache['results'] : [];
    $cleaned = [];
    foreach ($results as $url => $entry) {
        if (!is_array($entry)) continue;
        $ts = $entry['ts'] ?? 0;
        if ($now - $ts > MAX_AGE) continue;   // 过期剔除，不再返回
        $cleaned[$url] = [
            'alive' => $entry['alive'] ?? false,
            'icon'  => isset($entry['icon']) ? $entry['icon'] : null,
            'ts'    => $ts,
        ];
    }
    // 如果剔除后结果有变化，顺手回写一次
    if (count($cleaned) !== count($results)) {
        writeCacheRaw(['ts' => $cache['ts'] ?? 0, 'results' => $cleaned]);
    }
    sendJson(['ts' => $cache['ts'] ?? 0, 'count' => count($cleaned), 'results' => $cleaned]);
}

// ---------- 写：合并用户上报的最新结果 ----------
function doWrite() {
    // 频率限制：防止高频刷写
    if (!checkWriteRateLimit()) {
        sendJson(['ok' => false, 'error' => 'rate limited']);
    }

    $input = file_get_contents('php://input');
    $payload = json_decode($input, true);
    if (!is_array($payload) || !isset($payload['results']) || !is_array($payload['results'])) {
        sendJson(['ok' => false, 'error' => 'invalid payload']);
    }

    $now = time();
    $incoming = $payload['results'];
    if (count($incoming) > MAX_ENTRIES) {
        sendJson(['ok' => false, 'error' => 'too many entries']);
    }

    // 规范化 + 只接受更新鲜的条目
    $normalized = [];
    foreach ($incoming as $url => $entry) {
        if (!is_string($url) || !is_array($entry)) continue;
        // 只接受 http(s) 开头的 URL，防注入垃圾 key
        if (preg_match('#^https?://#i', $url) !== 1) continue;
        $alive = isset($entry['alive']) ? (bool)$entry['alive'] : false;
        $icon  = isset($entry['icon']) && is_string($entry['icon']) ? $entry['icon'] : null;
        $ts    = isset($entry['ts']) ? (int)$entry['ts'] : $now;
        // 不接受未来时间
        if ($ts > $now + 60) $ts = $now;
        $normalized[$url] = ['alive' => $alive, 'icon' => $icon, 'ts' => $ts];
    }

    if (!$normalized) sendJson(['ok' => false, 'error' => 'empty']);

    // 读取现有缓存并合并：每个 URL 取更新的那条
    $existing = readCacheRaw();
    $merged = ($existing && isset($existing['results']) && is_array($existing['results']))
        ? $existing['results'] : [];
    foreach ($normalized as $url => $entry) {
        if (!isset($merged[$url]) || $entry['ts'] >= ($merged[$url]['ts'] ?? 0)) {
            $merged[$url] = $entry;
        }
    }
    // 清掉过期条目，控制文件体积
    $cleaned = [];
    foreach ($merged as $url => $entry) {
        if ($now - ($entry['ts'] ?? 0) <= MAX_AGE) $cleaned[$url] = $entry;
    }

    $ok = writeCacheRaw(['ts' => $now, 'results' => $cleaned]);
    sendJson(['ok' => (bool)$ok, 'count' => count($cleaned), 'ts' => $now]);
}

// ---------- 路由 ----------
$action = $_GET['action'] ?? '';
if ($_SERVER['REQUEST_METHOD'] === 'GET' && $action === 'read') {
    doRead();
} elseif ($_SERVER['REQUEST_METHOD'] === 'POST' && $action === 'write') {
    doWrite();
}

sendJson(['ok' => false, 'error' => 'bad action']);
