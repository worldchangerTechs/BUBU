const { handleVoiceCommand, handleTextCommand } = require('./voiceRouter');
const logger = require('./logger');

// Text mode: `node src/voiceTrigger.js "read my messages"` or piped stdin.
// Voice mode (default): `node src/voiceTrigger.js` listens via Termux:API.
function readStdin() {
	return new Promise((resolve) => {
		if (process.stdin.isTTY) {
			resolve('');
			return;
		}
		let data = '';
		process.stdin.setEncoding('utf8');
		process.stdin.on('data', (chunk) => { data += chunk; });
		process.stdin.on('end', () => resolve(data.trim()));
	});
}

(async () => {
	try {
		const cliText = process.argv.slice(2).filter((arg) => arg !== '--').join(' ').trim();
		if (cliText) {
			await handleTextCommand(cliText);
			return;
		}
		const pipedText = await readStdin();
		if (pipedText) {
			await handleTextCommand(pipedText);
			return;
		}
		await handleVoiceCommand();
	} catch (error) {
		logger.error(`[bubu] Voice command failed: ${error.message}`);
		process.exitCode = 1;
	}
})();
