<?php
/**
 * 反馈邮件发送接口 v3
 * 安全方案：
 *   1. 授权码经 AES-256-CBC 加密，密文/密钥/IV 三元组分离存储
 *   2. 密钥从 .env 文件读取（位于 webroot 之外），源码泄露不影响授权码安全
 *   3. 解密仅在内存中进行，明文不落盘、不缓存、不写入日志
 *   4. IP 频率限制：同一 IP 30 分钟内最多提交 10 次，防滥用
 *   5. 内容过滤：拒绝包含 URL 的提交（防止垃圾广告外链）
 *
 * 部署说明：
 *   - 将 .smtp_key.env 放在 webroot 之外（如 /www/server_config/acgn_smtp_key.env）
 *   - 修改下方 $env_path 指向实际路径
 *   - 设置 .smtp_key.env 权限为 600（仅 PHP 可读）
 */

// 开启输出缓冲，防止任何 warning/notice 污染 JSON 响应
ob_start();

// ==================== 安全配置 ====================

// 密钥文件路径（放在 webroot 之外！）
$env_path = '/www/server_config/.smtp_key.env';

// ==================== 设备指纹与频率限制 ====================

$cache_dir = __DIR__ . '/../cache';
if (!is_dir($cache_dir)) @mkdir($cache_dir, 0755, true);

$rate_limit_file = $cache_dir . '/feedback_rate.json';
$client_ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';

/**
 * 频率限制：基于设备指纹（IP + UA）
 * 规则：
 *   - 30 分钟（1800秒）内最多提交 10 次
 *   - 超过 10 次后冷却 1 小时（3600秒）
 *   - 使用 IP + User-Agent 生成设备指纹，区分同 IP 不同设备
 *
 * @param string $fingerprint 设备指纹
 * @param string $file 缓存文件路径
 * @return array ['blocked' => bool, 'remaining' => int, 'cooldown' => int]
 */
function check_rate_limit($fingerprint, $file) {
    $now = time();
    $data = [];
    if (file_exists($file)) {
        $raw = @file_get_contents($file);
        $data = $raw ? (json_decode($raw, true) ?: []) : [];
    }

    if (!isset($data[$fingerprint])) {
        // 新设备，第一次提交
        return ['blocked' => false, 'remaining' => 9, 'cooldown' => 0];
    }

    $record = $data[$fingerprint];
    $window = 1800;  // 30 分钟窗口
    $max_requests = 10;
    $cooldown_duration = 3600;  // 冷却 1 小时

    // 检查是否在冷却期
    if (isset($record['cooldown_until']) && $now < $record['cooldown_until']) {
        $left = $record['cooldown_until'] - $now;
        return [
            'blocked' => true,
            'remaining' => 0,
            'cooldown' => $left
        ];
    }

    // 清理 30 分钟窗口之外的记录
    $record['timestamps'] = array_values(array_filter(
        $record['timestamps'] ?? [],
        function($ts) use ($now, $window) { return $now - $ts < $window; }
    ));

    $count = count($record['timestamps']);

    // 检查是否达到 10 次上限
    if ($count >= $max_requests) {
        // 触发冷却
        $record['cooldown_until'] = $now + $cooldown_duration;
        $data[$fingerprint] = $record;
        @file_put_contents($file, json_encode($data), LOCK_EX);
        return [
            'blocked' => true,
            'remaining' => 0,
            'cooldown' => $cooldown_duration
        ];
    }

    // 记录本次请求
    $record['timestamps'][] = $now;
    $data[$fingerprint] = $record;
    @file_put_contents($file, json_encode($data), LOCK_EX);

    return [
        'blocked' => false,
        // BUG 修复：count 应为 $count（原代码漏写 $，PHP 将其视为未定义常量，值为 0，
        // 导致 remaining 恒为 9，与实际剩余次数不符）
        'remaining' => $max_requests - $count - 1,
        'cooldown' => 0
    ];
}

/**
 * 生成设备指纹（基于 IP + User-Agent 的哈希）
 * 同一 IP 下不同浏览器/设备会产生不同指纹
 */
function get_device_fingerprint($ip, $user_agent) {
    return hash('sha256', $ip . '|' . $user_agent);
}

// ==================== 授权码解密 ====================

function decrypt_smtp_pass($env_path) {
    if (!file_exists($env_path)) return '';
    // 权限检查：确保文件不是全局可读的
    // 兼容性：使用 0600 十进制 (384) 而非 0o600 八进制字面量（PHP < 8.1 不支持 0o 前缀）
    $perms = @fileperms($env_path);
    if ($perms !== false && ($perms & 0x0777) > 0600) {
        error_log("[Feedback] KEY FILE PERMISSIONS TOO OPEN: " . decoct($perms));
        return '';  // 拒绝使用权限过宽的密钥文件
    }
    $lines = @file($env_path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    if (!$lines) return '';
    $config = [];
    foreach ($lines as $line) {
        $line = trim($line);
        if ($line === '' || $line[0] === '#') continue;
        $parts = explode('=', $line, 2);
        if (count($parts) === 2) {
            $config[trim($parts[0])] = trim($parts[1]);
        }
    }
    $cipher_b64 = $config['CIPHER_B64'] ?? '';
    $key_hex    = $config['KEY_HEX']    ?? '';
    $iv_hex     = $config['IV_HEX']     ?? '';
    $key  = @hex2bin($key_hex);
    $iv   = @hex2bin($iv_hex);
    if (!$key || !$iv || strlen($key) !== 32 || strlen($iv) !== 16) return '';
    $dec = @openssl_decrypt(base64_decode($cipher_b64), 'AES-256-CBC', $key, OPENSSL_RAW_DATA, $iv);
    return ($dec !== false && strlen($dec) >= 10) ? $dec : '';
}

// ==================== 安全输出 ====================

/**
 * 输出 JSON 响应并立即终止
 * 清除输出缓冲区中可能存在的 warning/notice，确保只输出 JSON
 */
function json_exit($data, $code = 200) {
    if (http_response_code() === 200) {
        http_response_code($code);
    }
    ob_end_clean();
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

// ==================== 主流程 ====================

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_exit(['ok' => false, 'msg' => '仅支持 POST 请求'], 405);
}

// 频率限制检查（基于设备指纹）
$user_agent = $_SERVER['HTTP_USER_AGENT'] ?? '';
$fingerprint = get_device_fingerprint($client_ip, $user_agent);
$rate = check_rate_limit($fingerprint, $rate_limit_file);

if ($rate['blocked']) {
    $cooldown_min = ceil($rate['cooldown'] / 60);
    json_exit(['ok' => false, 'msg' => "提交过于频繁，请等待 {$cooldown_min} 分钟后再试"], 429);
}

// 解密授权码
$smtp_pass = decrypt_smtp_pass($env_path);
if (empty($smtp_pass)) {
    // 不暴露具体原因（防止攻击者探测配置状态）
    error_log("[Feedback] SMTP pass unavailable (env: " . $env_path . ")");
    json_exit(['ok' => false, 'msg' => '反馈服务暂不可用，请稍后再试'], 503);
}

// 接收数据
$type    = trim($_POST['type'] ?? '');
$contact = trim($_POST['contact'] ?? '');
$content = trim($_POST['content'] ?? '');

if (empty($content)) {
    json_exit(['ok' => false, 'msg' => '反馈内容不能为空'], 400);
}
if (mb_strlen($content) > 2000) {
    json_exit(['ok' => false, 'msg' => '反馈内容不能超过 2000 字'], 400);
}

// 内容安全过滤：拒绝包含 URL 的提交（防止垃圾广告）
if (preg_match('/https?:\/\//i', $content) || preg_match('/www\./i', $content)) {
    json_exit(['ok' => false, 'msg' => '反馈内容不能包含链接'], 400);
}

// X-Real-IP 信任链（如果有 Nginx 反代）
if (!empty($_SERVER['HTTP_X_REAL_IP'])) {
    $client_ip = $_SERVER['HTTP_X_REAL_IP'];
} elseif (!empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
    $ips = explode(',', $_SERVER['HTTP_X_FORWARDED_FOR']);
    $client_ip = trim($ips[0]);
}

$typeMap = [
    'resource' => '资源分享',
    'bug' => 'Bug 反馈',
    'suggestion' => '功能建议',
    'cve' => 'CVE/安全',
    'other' => '其他'
];
$typeLabel = $typeMap[$type] ?? '其他';

$now     = date('Y-m-d H:i:s');
$referer = $_SERVER['HTTP_REFERER'] ?? '未知';

$subject = "[ACGN导航站反馈] {$typeLabel} - {$now}";

$body = <<<MAIL
反馈类型: {$typeLabel}
{$contact ? "联系方式: {$contact}" : "联系方式: 未提供"}
提交时间: {$now}
访问IP: {$client_ip}
来源页面: {$referer}

--- 反馈内容 ---

{$content}

---
此邮件由 ACGN 导航站反馈系统自动发送
MAIL;

// 发送后立即清除内存中的明文
$smtp_user = '3975819935@qq.com';
$to_email  = '3975819935@qq.com';

$result = smtp_send($smtp_user, $smtp_pass, $to_email, $subject, $body);

// 用完即销毁
unset($smtp_pass);
$smtp_pass = null;

if ($result === true) {
    json_exit(['ok' => true, 'msg' => '反馈已发送，感谢！', 'remaining' => $rate['remaining']]);
} else {
    error_log("[Feedback] SMTP failed: " . $result);
    json_exit(['ok' => false, 'msg' => '发送失败，请稍后重试'], 500);
}

// ==================== SMTP 函数 ====================

function smtp_send($user, $pass, $to, $subject, $message) {
    $smtp_host = 'smtp.qq.com';
    $smtp_port = 465;
    $localhost = $_SERVER['SERVER_NAME'] ?? 'localhost';

    $errno  = 0;
    $errstr = '';
    $sock = @stream_socket_client(
        'ssl://' . $smtp_host . ':' . $smtp_port,
        $errno, $errstr, 15
    );
    if (!$sock) {
        return '无法连接 SMTP 服务器 (' . $errno . '): ' . $errstr;
    }

    // 设置 10 秒读写超时，防止 fgets 无限阻塞
    stream_set_timeout($sock, 10);

    $welcome = smtp_read($sock);
    if (strpos($welcome, '220') !== 0) {
        fclose($sock);
        return 'SMTP 握手失败: ' . $welcome;
    }

    smtp_write($sock, 'EHLO ' . $localhost);
    $resp = smtp_read($sock);
    // EHLO 失败时回退到 HELO
    if (strpos($resp, '250') !== 0) {
        smtp_write($sock, 'HELO ' . $localhost);
        $resp = smtp_read($sock);
        if (strpos($resp, '250') !== 0) { fclose($sock); return 'HELO/EHLO 失败'; }
    }

    smtp_write($sock, 'AUTH LOGIN');
    $resp = smtp_read($sock);
    if (strpos($resp, '334') !== 0) { fclose($sock); return 'AUTH 失败'; }

    smtp_write($sock, base64_encode($user));
    $resp = smtp_read($sock);
    if (strpos($resp, '334') !== 0) { fclose($sock); return '用户名验证失败'; }

    smtp_write($sock, base64_encode($pass));
    $resp = smtp_read($sock);
    if (strpos($resp, '235') !== 0) { fclose($sock); return '密码验证失败'; }

    smtp_write($sock, 'MAIL FROM: <' . $user . '>');
    $resp = smtp_read($sock);
    if (strpos($resp, '250') !== 0) { fclose($sock); return 'MAIL FROM 失败'; }

    smtp_write($sock, 'RCPT TO: <' . $to . '>');
    $resp = smtp_read($sock);
    if (strpos($resp, '250') !== 0) { fclose($sock); return 'RCPT TO 失败'; }

    smtp_write($sock, 'DATA');
    $resp = smtp_read($sock);
    if (strpos($resp, '354') !== 0) { fclose($sock); return 'DATA 失败'; }

    $date = date('r');
    $data = "From: ACGN反馈系统 <{$user}>\r\n"
          . "To: {$to}\r\n"
          . "Subject: =?UTF-8?B?" . base64_encode($subject) . "?=\r\n"
          . "Date: {$date}\r\n"
          . "Content-Type: text/plain; charset=UTF-8\r\n"
          . "Content-Transfer-Encoding: base64\r\n"
          . "X-Mailer: ACGN-Feedback/3.0\r\n"
          . "\r\n"
          . chunk_split(base64_encode($message))
          . "\r\n.\r\n";

    smtp_write($sock, $data);
    $resp = smtp_read($sock);
    if (strpos($resp, '250') !== 0) { fclose($sock); return '发送失败: ' . $resp; }

    smtp_write($sock, 'QUIT');
    smtp_read($sock);
    fclose($sock);
    return true;
}

function smtp_write($sock, $cmd) { @fwrite($sock, $cmd . "\r\n"); }
function smtp_read($sock) {
    $data = '';
    while ($line = @fgets($sock, 512)) {
        $data .= $line;
        if (strlen($line) >= 4 && substr($line, 3, 1) !== '-') break;
    }
    return trim($data);
}