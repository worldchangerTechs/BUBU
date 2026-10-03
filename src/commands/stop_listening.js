const { say } = require('../audio');

module.exports = {
	id: 'STOP_LISTENING',
	examples: ['stop listening', 'mic off', 'go to sleep'],
	match(text) {
		if (/\b(stop listening|mic off|go to sleep)\b/.test(text)) return {};
		return null;
	},
	async run(ctx) {
		ctx.stopListening();
		await say('Listening paused, sir.');
	}
};