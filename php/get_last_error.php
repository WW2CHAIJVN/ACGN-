<?php
/**
 * 获取后端最近一次错误信息（调试用）
 *
 * 安全：限制为同源访问，防止第三方网站通过 CORS 读取错误信息
 */
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$host   = $_SERVER['HTTP_HOST'] ?? '';
// 仅当 Origin 为空或与本站同源时才允许访问
$allow = false;
if (empty($origin)) {
    $allow = true;
} else {
    $parsed = parse_url($origin);
    if ($parsed && isset($parsed['host']) && $parsed['host'] === $host) {
        $allow = true;
    }
}

if (!$allow) {
    http_response_code(403);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => 'forbidden'], JSON_UNESCAPED_UNICODE);
    exit;
}

session_start();
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: ' . ($origin ?: '*'));

$error = $_SESSION['last_backend_error'] ?? null;
unset($_SESSION['last_backend_error']);  // 读一次就删

echo json_encode(['error' => $error], JSON_UNESCAPED_UNICODE);
?>
