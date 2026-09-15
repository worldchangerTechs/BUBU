const { execFile } = require('node:child_process');
const logger = require('../logger');
const { setSpeaking } = require('../hud/terminalHud');

// BUBU voice: young American lady, on-device, no cloud needed.
// Override any of these with env vars, e.g.:
//   BUBU_VOICE_ENGINE=com.google.android.tts BUBU_VOICE_LANGUAGE=en-US
//   BUBU_VOICE_PITCH=1.15 BUBU_VOICE_RATE=1.05 npm run up
const DEFAULT_ENGINE = process.env.BUBU_VOICE_ENGINE || 'com.google.android.tts';
const DEFAULT_LANGUAGE = process.env.BUBU_VOICE_LANGUAGE || 'en-US';
const DEFAULT_PITCH = process.env.BUBU_VOICE_PITCH || '1.15';
const DEFAULT_RATE = process.env.BUBU_VOICE_RATE || '1.05';

function voiceArgs(text) {
	const args = [];
	if (DEFAULT_ENGINE) args.push('-e', DEFAULT_ENGINE);
	if (DEFAULT_LANGUAGE) args.push('-l', DEFAULT_LANGUAGE);
	if (DEFAULT_PITCH) args.push('-p', DEFAULT_PITCH);
	if (DEFAULT_RATE) args.push('-r', DEFAULT_RATE);
	// MUSIC stream keeps BUBU audible even when the phone is on vibrate.
	args.push('-s', process.env.BUBU_VOICE_STREAM || 'MUSIC');
	args.push(String(text));
	return args;
}

async function speak(text) {
	return new Promise((resolve, reject) => {
		setSpeaking(true);
		try {
			execFile('termux-tts-speak', voiceArgs(text), (error) => {
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

module.exports = { speak, voiceArgs };
