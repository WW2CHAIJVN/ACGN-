// ========== 音乐播放器模块 ==========
const island = document.getElementById('musicIsland');
const overlay = document.getElementById('musicOverlay');
const minimizeBtn = document.getElementById('musicMinimize');
const searchBtn = document.getElementById('searchBtn');
const searchInput = document.getElementById('searchInput');
const qualitySelect = document.getElementById('qualitySelect');
const musicList = document.getElementById('musicList');
const playPauseBtn = document.getElementById('playPauseBtn');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const currentTitle = document.getElementById('currentTitle');
const currentArtist = document.getElementById('currentArtist');
const islandSong = document.getElementById('islandSong');
const progressBar = document.getElementById('progressBar');
const progressFill = document.getElementById('musicProgressFill');
const currentTimeSpan = document.getElementById('currentTime');
const durationSpan = document.getElementById('duration');

let playlist = [], currentIndex = 0, currentAudio = null, isPlaying = false;
let currentBitrate = 320;
let currentSongId = null;

function formatTime(seconds) {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function updateProgress() {
    if (currentAudio && currentAudio.duration && !isNaN(currentAudio.duration)) {
        progressFill.style.width = `${(currentAudio.currentTime / currentAudio.duration) * 100}%`;
        currentTimeSpan.textContent = formatTime(currentAudio.currentTime);
        durationSpan.textContent = formatTime(currentAudio.duration);
    }
}

async function getSongUrl(songId, bitrate) {
    const brMap = { 128: 128000, 192: 192000, 320: 320000, flac: 999000 };
    const br = brMap[bitrate] || 320000;
    const url = `/php/ncm_proxy.php?action=url&id=${songId}&br=${br}`;
    try {
        const res = await fetch(url);
        const data = await res.json();
        return data.url || null;
    } catch { return null; }
}

async function getAvailableQualities(songId) {
    const bitrates = [128, 192, 320, 'flac'];
    const results = [];
    for (const br of bitrates) {
        const url = await getSongUrl(songId, br);
        if (url) results.push(br);
    }
    return results;
}

function updateQualitySelect(qualities, currentBr) {
    qualitySelect.innerHTML = '';
    if (!qualities.length) { qualitySelect.innerHTML = '<option>无可用音质</option>'; return; }
    qualities.forEach(br => {
        const option = document.createElement('option');
        option.value = br;
        option.textContent = br === 'flac' ? '无损 FLAC' : `${br}kbps`;
        if (br == currentBr) option.selected = true;
        qualitySelect.appendChild(option);
    });
}

/**
 * 清理旧音频对象的事件监听器，防止内存泄漏
 * @param {HTMLAudioElement|null} audio 待清理的音频对象
 */
function cleanupAudio(audio) {
    if (!audio) return;
    audio.pause();
    audio.removeEventListener('timeupdate', updateProgress);
    audio.removeEventListener('loadedmetadata', audio._onLoadedMeta);
    audio.removeEventListener('ended', audio._onEnded);
    audio.src = '';
}

async function playSong(index) {
    if (index < 0 || index >= playlist.length) return;
    currentIndex = index;
    const song = playlist[currentIndex];
    currentSongId = song.id;
    currentTitle.textContent = song.name;
    currentArtist.textContent = song.artist;
    islandSong.textContent = `${song.name} - ${song.artist}`;
    const qualities = await getAvailableQualities(song.id);
    updateQualitySelect(qualities, currentBitrate);
    let brToUse = currentBitrate;
    if (!qualities.includes(brToUse) && qualities.length) brToUse = qualities[0];
    const url = await getSongUrl(song.id, brToUse);
    if (!url) { alert('获取播放地址失败'); return; }

    // 清理旧音频，避免事件监听器堆积导致内存泄漏
    cleanupAudio(currentAudio);

    currentAudio = new Audio(url);
    // 将回调引用保存在音频对象上，便于 cleanupAudio 中移除
    currentAudio._onLoadedMeta = () => { durationSpan.textContent = formatTime(currentAudio.duration); };
    currentAudio._onEnded = () => playNext();
    currentAudio.addEventListener('timeupdate', updateProgress);
    currentAudio.addEventListener('loadedmetadata', currentAudio._onLoadedMeta);
    currentAudio.addEventListener('ended', currentAudio._onEnded);
    currentAudio.play();
    isPlaying = true;
    playPauseBtn.innerHTML = icon('pause');
    island.style.display = 'flex';
}

function togglePlay() {
    if (!currentAudio) return;
    if (isPlaying) { currentAudio.pause(); playPauseBtn.innerHTML = icon('play_arrow'); isPlaying = false; }
    else { currentAudio.play(); playPauseBtn.innerHTML = icon('pause'); isPlaying = true; }
}

function playNext() { if (playlist.length) playSong((currentIndex + 1) % playlist.length); }
function playPrev() { if (playlist.length) playSong((currentIndex - 1 + playlist.length) % playlist.length); }

function searchSongs() {
    const keyword = searchInput.value.trim();
    if (!keyword) { alert('请输入关键词'); return; }
    musicList.innerHTML = '<div class="music-list-empty">搜索中...</div>';
    fetch(`/php/ncm_proxy.php?action=search&keyword=${encodeURIComponent(keyword)}`)
        .then(res => res.json())
        .then(data => {
            if (!data.length) { musicList.innerHTML = '<div class="music-list-empty">未找到歌曲</div>'; return; }
            playlist = data.map(song => ({ id: song.id, name: song.name, artist: song.artist, duration: song.duration }));
            renderPlaylist();
        })
        .catch(() => { musicList.innerHTML = '<div class="music-list-empty">搜索失败</div>'; });
}

function renderPlaylist() {
    musicList.innerHTML = '';
    playlist.forEach((song, idx) => {
        const div = document.createElement('div');
        div.className = 'music-list-item';
        div.innerHTML = `<div><div class="music-list-name">${escapeHtml(song.name)}</div><div class="music-list-artist">${escapeHtml(song.artist)}</div></div><div class="music-list-duration">${formatTime(song.duration / 1000)}</div>`;
        div.onclick = () => { playSong(idx); overlay.classList.remove('active'); };
        musicList.appendChild(div);
    });
}

function openPlayer() { overlay.classList.add('active'); }
function closePlayer() { overlay.classList.remove('active'); }

qualitySelect.addEventListener('change', async () => {
    const newBr = qualitySelect.value;
    if (!newBr || !currentSongId || newBr == currentBitrate) return;
    const url = await getSongUrl(currentSongId, newBr);
    if (!url) { alert('切换失败'); return; }
    currentBitrate = newBr;
    const wasPlaying = isPlaying;
    const currentTime = currentAudio ? currentAudio.currentTime : 0;

    // 清理旧音频，避免内存泄漏
    cleanupAudio(currentAudio);

    const newAudio = new Audio(url);
    newAudio._onLoadedMeta = () => { durationSpan.textContent = formatTime(newAudio.duration); };
    newAudio._onEnded = () => playNext();
    newAudio.addEventListener('timeupdate', updateProgress);
    newAudio.addEventListener('loadedmetadata', newAudio._onLoadedMeta);
    newAudio.addEventListener('ended', newAudio._onEnded);
    newAudio.currentTime = currentTime;
    if (wasPlaying) newAudio.play();
    currentAudio = newAudio;
    isPlaying = wasPlaying;
    playPauseBtn.innerHTML = wasPlaying ? icon('pause') : icon('play_arrow');
});

minimizeBtn.onclick = closePlayer;
overlay.onclick = (e) => { if (e.target === overlay) closePlayer(); };
island.onclick = openPlayer;
searchBtn.onclick = searchSongs;
searchInput.onkeypress = (e) => { if (e.key === 'Enter') searchSongs(); };
playPauseBtn.onclick = togglePlay;
prevBtn.onclick = playPrev;
nextBtn.onclick = playNext;
progressBar.onclick = (e) => {
    if (!currentAudio) return;
    const rect = progressBar.getBoundingClientRect();
    currentAudio.currentTime = ((e.clientX - rect.left) / rect.width) * currentAudio.duration;
};

window.openMusicPlayer = openPlayer;

// 离开页面时释放 Audio 资源，防止后台持续占用网络连接和内存
window.addEventListener('beforeunload', function() {
    cleanupAudio(currentAudio);
    currentAudio = null;
    playlist = [];
});
