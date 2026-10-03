const { say } = require('../audio');
const { phrase } = require('../personality');
const { listSms } = require('../termux/sms');

module.exports = {
	id: 'READ_TEXTS',
	examples: ['read texts', 'read sms', 'read my texts'],
	match(text) {
		if (/\bread (?:my )?texts?\b|\bread sms\b/.test(text)) return {};
		return null;
	},
	async run(ctx) {
		const messages = await listSms(3);
		for (const message of messages) {
			await say(phrase('DIGEST_ITEM', {
				kind: 'text',
				from: message.from,
				text: message.body
			}));
		}
	}
};