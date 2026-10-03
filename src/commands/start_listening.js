const { say } = require('../audio');

module.exports = {
	id: 'START_LISTENING',
	examples: ['wake up', 'mic on', 'start listening'],
	match(text) {
		if (/\b(wake up|mic on|start listening)\b/.test(text)) return {};
		return null;
	},
	async run(ctx) {
		await say('Listening resumed, sir.');
		if (ctx.listeningLoopPromise) {
			ctx.startListeningLoop();
		} else {
			ctx.setListeningState(true);
		}
	}
};