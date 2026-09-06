const { handleVoiceCommand } = require('./voiceRouter');
const logger = require('./logger');

(async () => {
	try {
		await handleVoiceCommand();
	} catch (error) {
		logger.error(`[bubu] Voice command failed: ${error.message}`);
		process.exitCode = 1;
	}
})();
