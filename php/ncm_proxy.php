<?php
/**
 * 网易云音乐 API 代理
 * 目的：前端直接请求网易云会被 CORS 拦截，通过此 PHP 代理中转。
 *
 * 安全：
 *   - action 白名单：只允许 search / url
 *   - songId 强制整数过滤，防止注入
 *   - bitrate 白名单校验
 *   - keyword 长度限制 + urlencode
 */
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

$action = $_GET['action'] ?? '';
$keyword = $_GET['keyword'] ?? '';
$songId  = $_GET['id'] ?? '';
$br      = $_GET['br'] ?? '320000';

// action 白名单
if (!in_array($action, ['search', 'url'], true)) {
    echo json_encode(['error' => 'invalid action']);
    exit;
}

// keyword 长度限制（防超大 payload）
if ($action === 'search') {
    if (empty($keyword)) {
        echo json_encode(['error' => 'keyword required']);
        exit;
    }
    if (mb_strlen($keyword) > 100) {
        echo json_encode(['error' => 'keyword too long']);
        exit;
    }
}

// songId 强制整数过滤（防注入）
if ($action === 'url') {
    if (empty($songId) || !ctype_digit((string)$songId)) {
        echo json_encode(['error' => 'invalid song id']);
        exit;
    }
    $songId = (int)$songId;
    // bitrate 白名单
    $allowedBr = ['128000', '192000', '320000', '999000'];
    if (!in_array($br, $allowedBr, true)) {
        $br = '320000';
    }
}

if ($action === 'search' && $keyword) {
    $url = 'https://music.163.com/api/cloudsearch/pc?csrf_token=hlpretag&hlposttag&s=' . urlencode($keyword) . '&type=1&offset=0&limit=30';

    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    // 安全提示：生产环境应启用 SSL 验证；网易云证书正常，可设为 true
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    curl_setopt($ch, CURLOPT_USERAGENT, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    curl_setopt($ch, CURLOPT_REFERER, 'https://music.163.com');
    $response = curl_exec($ch);
    curl_close($ch);

    $data = json_decode($response, true);
    $songs = [];

    if ($data && isset($data['result']['songs'])) {
        foreach ($data['result']['songs'] as $song) {
            $songs[] = [
                'id' => $song['id'],
                'name' => $song['name'],
                'artist' => $song['artists'][0]['name'] ?? '未知',
                'duration' => $song['duration'] ?? 0
            ];
        }
    }
    echo json_encode($songs);
}
elseif ($action === 'url' && $songId) {
    $url = 'https://music.163.com/api/song/enhance/player/url?id=' . $songId . '&br=' . $br;

    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    // 安全提示：生产环境应启用 SSL 验证
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    curl_setopt($ch, CURLOPT_USERAGENT, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    curl_setopt($ch, CURLOPT_REFERER, 'https://music.163.com');
    $response = curl_exec($ch);
    curl_close($ch);

    $data = json_decode($response, true);
    $result = ['url' => null];

    if ($data && isset($data['data'][0]['url'])) {
        $result['url'] = $data['data'][0]['url'];
    }
    echo json_encode($result);
}
else {
    echo json_encode(['error' => '参数错误']);
}
?>
