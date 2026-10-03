const { say } = require('../audio');
const { phrase } = require('../personality');
const { getRecentMessages } = require('../messageHandler');

module.exports = {
	id: 'READ_MESSAGES',
	examples: ['read messages', 'read whatsapp', 'read my messages'],
	match(text) {
		if (/\bread (?:my )?messages?\b|\bread whatsapp\b/.test(text)) return {};
		return null;
	},
	async run(ctx) {
		const messages = getRecentMessages();
		for (const message of messages) {
			await say(phrase('DIGEST_ITEM', { ...message, kind: 'message' }));
		}
	}
};