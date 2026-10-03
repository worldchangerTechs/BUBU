const https = require('node:https');

const CHECK_URL = 'https://www.gstatic.com/generate_204';
const CHECK_INTERVAL_MS = 20000;
const CHECK_TIMEOUT_MS = 1500;

let onlineCache = false;
let checkTimer = null;
const changeListeners = new Set();

function checkOnline() {
	if (process.env.BUBU_SIMULATE_OFFLINE === '1') {
		return Promise.resolve(false);
	}
	return new Promise((resolve) => {
		try {
			const req = https.request(CHECK_URL, { method: 'HEAD', timeout: CHECK_TIMEOUT_MS }, (res) => {
				res.resume();
				resolve(res.statusCode === 204);
			});
			req.on('error', () => resolve(false));
			req.on('timeout', () => { req.destroy(); resolve(false); });
			req.end();
		} catch {
			resolve(false);
		}
	});
}

async function refreshCache() {
	try {
		const isNowOnline = await checkOnline();
		if (isNowOnline !== onlineCache) {
			onlineCache = isNowOnline;
			for (const cb of changeListeners) {
				try { cb(onlineCache); } catch { /* ignore */ }
			}
		}
		return onlineCache;
	} catch {
		// never throw
		return onlineCache;
	}
}

function startPeriodicCheck() {
	if (checkTimer) return;
	refreshCache();
	checkTimer = setInterval(refreshCache, CHECK_INTERVAL_MS);
}

function stopPeriodicCheck() {
	if (checkTimer) {
		clearInterval(checkTimer);
		checkTimer = null;
	}
}

function isOnline() {
	if (!checkTimer) {
		startPeriodicCheck();
	}
	return onlineCache;
}

function onNetworkChange(cb) {
	if (typeof cb !== 'function') return () => {};
	changeListeners.add(cb);
	if (!checkTimer) startPeriodicCheck();
	return () => changeListeners.delete(cb);
}

function _setOnline(val) {
	const prev = onlineCache;
	onlineCache = Boolean(val);
	if (onlineCache !== prev) {
		for (const cb of changeListeners) {
			try { cb(onlineCache); } catch { /* ignore */ }
		}
	}
}

module.exports = { isOnline, onNetworkChange, refresh: refreshCache, _setOnline, stopPeriodicCheck };