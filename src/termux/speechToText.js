const { execFile } = require('node:child_process');
const logger = require('../logger');

async function listen() {
	return new Promise((resolve, reject) => {
		execFile('termux-speech-to-text', [], (error, stdout) => {
			if (!error) {
				resolve(String(stdout).trim().toLowerCase());
				return;
			}

			if (error.code === 'ENOENT') {
				logger.warn('termux-speech-to-text unavailable; install Termux:API to enable voice input.');
				resolve('');
				return;
			}

			if (error.code === 'EACCES' || /permission denied/i.test(error.message)) {
				reject(new Error('termux-speech-to-text permission was denied. Check Termux:API permissions.'));
				return;
			}

			reject(new Error(`termux-speech-to-text failed: ${error.message}`));
		});
	});
}

module.exports = { listen };
