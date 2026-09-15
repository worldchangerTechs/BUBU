const { execFile } = require('node:child_process');
const logger = require('../logger');

function runBinary(binary, args) {
	return new Promise((resolve, reject) => {
		execFile(binary, args, (error) => {
			if (error) {
				reject(error);
				return;
			}
			resolve();
		});
	});
}

// Opens a Google search on-device. Prefers the Android WEB_SEARCH intent
// (Google app handles it when present); falls back to opening the Google
// results URL, which Android routes to YouTube-app-style handling —
// i.e. the browser or Google app.
async function searchGoogle(query) {
	const text = String(query ?? '').trim();
	if (!text) {
		throw new Error('searchGoogle requires a query.');
	}
	try {
		await runBinary('am', ['start', '-a', 'android.intent.action.WEB_SEARCH', '--es', 'query', text]);
		return { method: 'intent' };
	} catch (error) {
		const reason = error?.code === 'ENOENT'
			? 'am is unavailable on this device'
			: error.message;
		logger.warn(`[launcher] WEB_SEARCH intent failed (${reason}); falling back to browser.`);
	}
	const url = `https://www.google.com/search?q=${encodeURIComponent(text)}`;
	await runBinary('termux-open-url', [url]);
	return { method: 'browser', url };
}

module.exports = { searchGoogle };
