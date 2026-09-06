const { handleVoiceCommand } = require('./voiceRouter');

(async () => {
	try {
		await handleVoiceCommand();
	} catch (error) {
		console.error(`[bubu] Voice command failed: ${error.message}`);
		process.exitCode = 1;
	}
})();
