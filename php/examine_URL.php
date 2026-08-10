<?php
/**
 * 站点状态探测与图标获取接口
 *
 * 安全说明：
 *   - 所有外部 URL 均经过 SSRF 防护验证，禁止访问内网 / 私有地址 / 非 http(s) 协议
 *   - SSL 验证在生产环境应启用（下方 CURLOPT_SSL_VERIFYPEER 设为 true）
 *   - 若服务器使用自签名证书导致 curl 失败，可临时设为 false，但需知悉中间人攻击风险
 */
session_start();
header('Content-Type: application/json');

function recordBackendError($msg) {
    $_SESSION['last_backend_error'] = $msg . ' (时间: ' . date('Y-m-d H:i:s') . ')';
}

/**
 * SSRF 防护：验证 URL 是否合法且不在私有/内网地址范围内
 *
 * @param string $url 待验证的 URL
 * @return bool true=合法且安全; false=存在 SSRF 风险
 */
function isSafeUrl($url) {
    // 1. 必须是有效的 URL 且协议为 http/https
    $parsed = parse_url($url);
    if (!$parsed || !isset($parsed['scheme'])) return false;
    $scheme = strtolower($parsed['scheme']);
    if ($scheme !== 'http' && $scheme !== 'https') return false;
    if (empty($parsed['host'])) return false;

    // 2. 禁止 IP 字面量（防止直接访问内网 IP）
    $host = $parsed['host'];
    // 过滤 IPv4 地址
    if (filter_var($host, FILTER_VALIDATE_IP)) {
        // 即使是公网 IP，也建议禁止；如需放行公网 IP，改用 filter_var + FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE
        return false;
    }
    // 过滤 IPv6 地址（含方括号格式如 [::1]）
    $hostNoBrackets = trim($host, '[]');
    if (filter_var($hostNoBrackets, FILTER_VALIDATE_IP, FILTER_FLAG_IPV6)) return false;

    // 3. 解析域名对应的 IP，检查是否指向私有/保留地址
    $ips = @gethostbynamel($host);
    if ($ips) {
        foreach ($ips as $ip) {
            if (!filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) {
                return false;
            }
        }
    }

    return true;
}

$url = $_GET['url'] ?? '';
$type = $_GET['type'] ?? 'status';

if (empty($url) && $type !== 'status') {
    recordBackendError('URL 参数为空');
    echo json_encode(['error' => 'missing url']);
    exit;
}

// SSRF 验证：type=status 时 url 可能为空(批量探测场景),不为空时才校验
if ($url && !isSafeUrl($url)) {
    recordBackendError('URL 未通过安全校验(禁止访问内网/私有地址)');
    echo json_encode(['error' => 'unsafe url']);
    exit;
}

// ========== 图标获取（修复 finfo_open 问题） ==========
if ($type === 'icon') {
    function getFavicon($url) {
        $parsed = parse_url($url);
        if (!isset($parsed['host'])) return null;
        $base = $parsed['scheme'] . '://' . $parsed['host'];
        $faviconUrl = $base . '/favicon.ico';

        $ch = curl_init($faviconUrl);
        curl_setopt($ch, CURLOPT_TIMEOUT, 3);
        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 2);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
        // 安全提示：生产环境应启用 SSL 验证；如使用自签名证书可临时关闭
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch, CURLOPT_USERAGENT, 'Mozilla/5.0');
        $data = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode != 200 || !$data) return null;

        // 修复：不用 finfo_open，直接根据文件头判断 MIME
        $mime = 'image/x-icon';  // 默认 .ico 格式
        $hex = bin2hex(substr($data, 0, 4));
        if ($hex === '89504e47') $mime = 'image/png';
        elseif ($hex === '47494638') $mime = 'image/gif';
        elseif ($hex === 'ffd8ffe0') $mime = 'image/jpeg';

        return 'data:' . $mime . ';base64,' . base64_encode($data);
    }

    $icon = getFavicon($url);
    echo json_encode(['url' => $url, 'icon' => $icon]);
    exit;
}

// ========== 状态探测：转发给 Node.js ==========
if ($type === 'status') {
    $nodeUrl = 'http://127.0.0.1:3000/probe?urls=' . urlencode($url);

    $ch = curl_init($nodeUrl);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 1);
    curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 1);
    curl_setopt($ch, CURLOPT_FAILONERROR, true);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $errno = curl_errno($ch);
    curl_close($ch);

    if ($errno || $httpCode !== 200) {
        $errorMsg = "Node.js 调用失败 (errno=$errno, http=$httpCode)";
        recordBackendError($errorMsg);
        echo json_encode(['url' => $url, 'alive' => false]);
        exit;
    }

    $data = json_decode($response, true);
    if (isset($data[$url])) {
        echo json_encode(['url' => $url, 'alive' => $data[$url]]);
    } else {
        recordBackendError("Node.js 返回结果中未找到 URL: $url");
        echo json_encode(['url' => $url, 'alive' => false]);
    }
    exit;
}

recordBackendError("未知的 type 参数: $type");
echo json_encode(['error' => 'invalid type']);
