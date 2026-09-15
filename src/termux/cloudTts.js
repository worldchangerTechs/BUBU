const { speak } = require('./tts');

// ElevenLabs voice-clone path removed: BUBU now speaks with a young
// American lady voice via on-device Termux TTS (no API key, no cloud).
// Kept the same `speakCloned` name/arity so voiceRouter.js and
// messageHandler.js work unchanged.
async function speakCloned(text) {
	await speak(text);
}

module.exports = { speakCloned };