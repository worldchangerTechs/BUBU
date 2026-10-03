const { execFile, spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { log } = require('./logger');
const { isOnline } = require('./net');

const CACHE_DIR = path.join(__dirname, '..', 'cache', 'tts');
const MAX_CACHE_SIZE = 50 * 1024 * 1024; // 50 MB LRU
const CLOUD_FAILURE_THRESHOLD = 2;
const CLOUD_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes
const GUARD_GAP_MS = 300;

const STATE = {
	IDLE: 'IDLE',
	THINKING: 'THINKING',
	SPEAKING: 'SPEAKING',
	LISTENING: 'LISTENING'
};

let currentState = STATE.IDLE;
const stateListeners = new Set();
const sayQueue = [];
let isProcessingQueue = false;
let cloudFailures = 0;
let cloudCooldownUntil = 0;
let mockListenTranscript = '';

function ensureCacheDir() {
	try {
		if (!fs.existsSync(CACHE_DIR)) {
			fs.mkdirSync(CACHE_DIR, { recursive: true });
		}
	} catch {
		// ignore
	}
}

function cacheKey(text) {
	return crypto.createHash('sha1').update(text, 'utf8').digest('hex');
}

function getCachePath(key) {
	return path.join(CACHE_DIR, `${key}.mp3`);
}

function pruneCache() {
	try {
		if (!fs.existsSync(CACHE_DIR)) return;
		const entries = fs.readdirSync(CACHE_DIR).map((f) => {
			const full = path.join(CACHE_DIR, f);
			try {
				const stats = fs.statSync(full);
				return { path: full, size: stats.size, mtime: stats.mtimeMs };
			} catch {
				return { path: full, size: 0, mtime: 0 };
			}
		});

		let totalSize = entries.reduce((acc, e) => acc + e.size, 0);
		if (totalSize <= MAX_CACHE_SIZE) return;

		// Sort oldest first (LRU)
		entries.sort((a, b) => a.mtime - b.mtime);
		for (const entry of entries) {
			if (totalSize <= MAX_CACHE_SIZE) break;
			try {
				fs.unlinkSync(entry.path);
				totalSize -= entry.size;
			} catch {
				// ignore
			}
		}
	} catch {
		// ignore
	}
}

function setState(newState) {
	if (currentState === newState) return;
	currentState = newState;
	for (const cb of stateListeners) {
		try {
			cb(currentState);
		} catch {
			// ignore
		}
	}
}

function getState() {
	return currentState;
}

function on(event, cb) {
	if (typeof event === 'function') {
		cb = event;
		event = 'state';
	}
	if (event !== 'state' || typeof cb !== 'function') return () => {};
	stateListeners.add(cb);
	return () => stateListeners.delete(cb);
}

function addSir(text) {
	if (!text || typeof text !== 'string') return text;
	if (/\bsir\b/i.test(text)) return text;
	const trimmed = text.trim();
	if (!trimmed) return trimmed;

	const lastChar = trimmed.slice(-1);
	if (lastChar === '.' || lastChar === '!' || lastChar === '?') {
		const base = trimmed.slice(0, -1).trimEnd();
		return `${base}, sir${lastChar}`;
	}
	return `${trimmed}, sir.`;
}

function estimateDurationMs(text, fileSize = 0) {
	const textEstimate = Math.max(1000, Math.ceil((text.length / 15) * 1000));
	const fileEstimate = fileSize > 0 ? Math.ceil((fileSize / 16000) * 1000) : 0;
	return Math.max(textEstimate, fileEstimate);
}

async function playWithMediaPlayer(filePath, text) {
	if (process.env.BUBU_MOCK_TERMUX === '1') {
		return new Promise((r) => setTimeout(r, 10));
	}
	return new Promise((resolve) => {
		let fileSize = 0;
		try {
			fileSize = fs.statSync(filePath).size;
		} catch {}
		const hardCapMs = estimateDurationMs(text, fileSize) + 5000;

		let finished = false;
		let pollTimer = null;
		let hardCapTimer = null;

		const cleanup = () => {
			if (finished) return;
			finished = true;
			if (pollTimer) clearInterval(pollTimer);
			if (hardCapTimer) clearTimeout(hardCapTimer);
			resolve();
		};

		const child = spawn('termux-media-player', ['play', filePath]);
		child.on('error', cleanup);
		child.on('close', () => {
			// Player started or finished
		});

		pollTimer = setInterval(() => {
			try {
				const infoChild = spawn('termux-media-player', ['info']);
				let out = '';
				infoChild.stdout.on('data', (d) => { out += d; });
				infoChild.on('close', () => {
					if (!out.includes('Playing')) {
						cleanup();
					}
				});
				infoChild.on('error', () => {
					cleanup();
				});
			} catch {
				cleanup();
			}
		}, 250);

		hardCapTimer = setTimeout(cleanup, hardCapMs);
	});
}

async function playWithTtsSpeak(text) {
	if (process.env.BUBU_MOCK_TERMUX === '1') {
		return new Promise((r) => setTimeout(r, 10));
	}
	return new Promise((resolve) => {
		execFile('termux-tts-speak', ['-e', 'com.google.android.tts', '-l', 'en-US', '-p', '1.15', '-r', '1.05', '-s', 'MUSIC', text], (error) => {
			if (error) {
				log.warn(`termux-tts-speak failed: ${error.message}`);
			}
			resolve();
		});
	});
}

async function fetchCloudTts(text) {
	const apiKey = process.env.ELEVENLABS_API_KEY;
	const voiceId = process.env.ELEVENLABS_VOICE_ID;
	if (!apiKey || !voiceId) return null;

	ensureCacheDir();
	const key = cacheKey(text);
	const cachePath = getCachePath(key);

	if (fs.existsSync(cachePath)) {
		try {
			fs.utimesSync(cachePath, new Date(), new Date());
		} catch {}
		pruneCache();
		return cachePath;
	}

	const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;
	try {
		const fetch = require('node-fetch');
		const res = await fetch(url, {
			method: 'POST',
			headers: {
				'xi-api-key': apiKey,
				'Content-Type': 'application/json',
				'Accept': 'audio/mpeg'
			},
			body: JSON.stringify({
				text,
				model_id: 'eleven_monolingual_v1',
				voice_settings: { stability: 0.5, similarity_boost: 0.75 }
			}),
			timeout: 10000
		});
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		const buffer = await res.buffer();
		fs.writeFileSync(cachePath, buffer);
		pruneCache();
		return cachePath;
	} catch (err) {
		log.warn(`ElevenLabs TTS fetch failed: ${err.message}`);
		return null;
	}
}

async function processQueue() {
	if (isProcessingQueue || sayQueue.length === 0) return;
	isProcessingQueue = true;

	while (sayQueue.length > 0) {
		const item = sayQueue.shift();
		const { text, opts } = item;
		setState(STATE.SPEAKING);

		const withSir = opts?.addSir !== false ? addSir(text) : text;
		let played = false;

		const isCloudConfigured = Boolean(process.env.ELEVENLABS_API_KEY && process.env.ELEVENLABS_VOICE_ID);
		const circuitOpen = cloudFailures >= CLOUD_FAILURE_THRESHOLD && Date.now() < cloudCooldownUntil;

		if (isOnline() && isCloudConfigured && !circuitOpen) {
			const cachePath = await fetchCloudTts(withSir);
			if (cachePath) {
				await playWithMediaPlayer(cachePath, withSir);
				played = true;
				cloudFailures = 0;
			} else {
				cloudFailures += 1;
				if (cloudFailures >= CLOUD_FAILURE_THRESHOLD) {
					cloudCooldownUntil = Date.now() + CLOUD_COOLDOWN_MS;
					log.warn('[audio] Circuit breaker opened: skipping cloud voice for 5 minutes');
				}
			}
		}

		if (!played) {
			await playWithTtsSpeak(withSir);
		}

		// 300 ms guard gap before mic can open
		await new Promise((r) => setTimeout(r, GUARD_GAP_MS));
	}

	isProcessingQueue = false;
	if (sayQueue.length === 0 && currentState === STATE.SPEAKING) {
		setState(STATE.IDLE);
	}
}

function say(text, opts = {}) {
	if (!text || !String(text).trim()) return;
	sayQueue.push({ text: String(text).trim(), opts });
	if (currentState !== STATE.SPEAKING) {
		processQueue();
	}
}

async function listenOnce() {
	// Wait until queue is empty and state is not SPEAKING
	while (sayQueue.length > 0 || currentState === STATE.SPEAKING) {
		await new Promise((r) => setTimeout(r, 50));
	}

	setState(STATE.LISTENING);

	if (process.env.BUBU_MOCK_TERMUX === '1') {
		await new Promise((r) => setTimeout(r, 10));
		const res = mockListenTranscript;
		mockListenTranscript = '';
		setState(STATE.IDLE);
		return (res || '').trim().toLowerCase();
	}

	return new Promise((resolve) => {
		let completed = false;
		let timer = null;
		let graceTimer = null;

		const finalize = (value) => {
			if (completed) return;
			completed = true;
			if (timer) clearTimeout(timer);
			if (graceTimer) clearTimeout(graceTimer);
			setState(STATE.IDLE);
			resolve(value);
		};

		const child = execFile('termux-speech-to-text', [], (error, stdout) => {
			if (completed) return;
			if (isIgnorableSttConnectionError(error)) {
				log.debug('[audio] Ignoring STT connection-refused shutdown from a terminated child process.');
				return;
			}
			finalize(!error && stdout ? String(stdout).trim().toLowerCase() : '');
		});

		child.on('error', (error) => {
			if (completed) return;
			if (isIgnorableSttConnectionError(error)) {
				log.debug('[audio] Ignoring STT ECONNREFUSED after graceful shutdown.');
				return;
			}
			finalize('');
		});

		timer = setTimeout(() => {
			if (completed) return;
			try { child.kill('SIGTERM'); } catch {}
			graceTimer = setTimeout(() => {
				if (completed) return;
				try { child.kill('SIGKILL'); } catch {}
				finalize('');
			}, 2000);
		}, 25000);
	});
}

function isIgnorableSttConnectionError(error) {
	if (!error) return false;
	const message = String(error.message || '').toLowerCase();
	return (
		error.code === 'ECONNREFUSED' ||
		error.code === 'ECONNRESET' ||
		message.includes('connection refused') ||
		message.includes('econnrefused') ||
		message.includes('socket hang up')
	);
}

function _setMockListenTranscript(str) {
	mockListenTranscript = String(str ?? '');
}

function _resetCircuitBreaker() {
	cloudFailures = 0;
	cloudCooldownUntil = 0;
}

function _getCircuitState() {
	return {
		cloudFailures,
		isCooldown: Date.now() < cloudCooldownUntil
	};
}

module.exports = {
	STATE,
	say,
	listenOnce,
	getState,
	setState,
	on,
	addSir,
	_setMockListenTranscript,
	_resetCircuitBreaker,
	_getCircuitState
};