const { execFile } = require('node:child_process');
const { log } = require('../logger');

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

async function listen() {
	return new Promise((resolve, reject) => {
		execFile('termux-speech-to-text', [], (error, stdout) => {
			if (!error) {
				resolve(String(stdout).trim().toLowerCase());
				return;
			}

			if (isIgnorableSttConnectionError(error)) {
				log.debug('[termux/speechToText] Ignoring STT connection-refused shutdown from a terminated child process.');
				resolve('');
				return;
			}

			if (error.code === 'ENOENT') {
				log.warn('termux-speech-to-text unavailable; install Termux:API to enable voice input.');
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
