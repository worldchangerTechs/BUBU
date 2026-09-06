const { execFile } = require('node:child_process');
const logger = require('../logger');

async function speak(text) {
	return new Promise((resolve, reject) => {
		execFile('termux-tts-speak', [String(text)], (error) => {
			if (!error) {
				resolve();
				return;
			}

			if (error.code === 'ENOENT') {
				logger.warn('termux-tts-speak unavailable; install Termux:API to enable speech.');
				resolve();
				return;
			}

			reject(new Error(`termux-tts-speak failed: ${error.message}`));
		});
	});
}

module.exports = { speak };
