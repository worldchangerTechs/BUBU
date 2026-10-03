const { say } = require('../audio');
const { phrase } = require('../personality');
const store = require('../store');

module.exports = {
	id: 'CANCEL_SEND',
	examples: ['cancel send', 'dont send', 'cancel'],
	match(text) {
		if (/^(?:no|cancel|dont send)$/.test(text)) return {};
		return null;
	},
	async run(ctx) {
		if (!store.getPendingReply()) {
			await say("There's nothing to send");
			return;
		}
		await say('Okay, not sending that');
		store.clearPendingReply();
	}
};