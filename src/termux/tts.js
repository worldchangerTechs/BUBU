const { execFile } = require('node:child_process');
const logger = require('../logger');
const { setSpeaking } = require('../hud/terminalHud');

async function speak(text) {
	return new Promise((resolve, reject) => {
		setSpeaking(true);
		try {
			execFile('termux-tts-speak', [String(text)], (error) => {
				setSpeaking(false);
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
		} catch (error) {
			setSpeaking(false);
			reject(error);
		}
	});
}

module.exports = { speak };
