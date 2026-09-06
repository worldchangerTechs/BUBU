const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { execFile } = require('node:child_process');
const fetch = require('node-fetch');
const logger = require('../logger');
const { setSpeaking } = require('../hud/terminalHud');
const { speak } = require('./tts');

const ELEVENLABS_URL = 'https://api.elevenlabs.io/v1/text-to-speech';

function playAudio(filePath) {
	return new Promise((resolve, reject) => {
		setSpeaking(true);
		try {
			execFile('termux-media-player', ['play', filePath], (error) => {
				setSpeaking(false);
				if (error) {
					reject(new Error(`termux-media-player failed: ${error.message}`));
					return;
				}

				resolve();
			});
		} catch (error) {
			setSpeaking(false);
			reject(error);
		}
	});
}

async function fallbackToSystemVoice(text, reason) {
	logger.warn(`${reason} Falling back to system voice.`);
	await speak(text);
}

async function speakCloned(text) {
	const apiKey = process.env.ELEVENLABS_API_KEY;
	const voiceId = process.env.ELEVENLABS_VOICE_ID;
	if (!apiKey || !voiceId) {
		await fallbackToSystemVoice(
			text,
			'ElevenLabs credentials are missing (ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID are required).'
		);
		return;
	}

	let tempFile;
	try {
		const response = await fetch(`${ELEVENLABS_URL}/${encodeURIComponent(voiceId)}`, {
			method: 'POST',
			headers: {
				'xi-api-key': apiKey,
				'Content-Type': 'application/json',
				Accept: 'audio/mpeg'
			},
			body: JSON.stringify({ text: String(text), model_id: 'eleven_multilingual_v2' })
		});

		if (!response.ok) {
			const errorBody = await response.text();
			throw new Error(`ElevenLabs returned ${response.status}: ${errorBody}`);
		}

		tempFile = path.join(os.tmpdir(), `bubu-cloud-tts-${process.pid}-${Date.now()}.mp3`);
		await fs.writeFile(tempFile, await response.buffer());
		await playAudio(tempFile);
	} catch (error) {
		await fallbackToSystemVoice(text, `Cloud voice unavailable: ${error.message}`);
	} finally {
		if (tempFile) {
			await fs.unlink(tempFile).catch(() => {});
		}
	}
}

module.exports = { speakCloned };