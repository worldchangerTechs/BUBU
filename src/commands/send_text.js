const { say } = require('../audio');
const { phrase } = require('../personality');
const { findContact } = require('../termux/contacts');
const { sendSms } = require('../termux/sms');

module.exports = {
	id: 'SEND_TEXT',
	examples: ['text john saying hello', 'send text to john saying hi'],
	match(text) {
		const m = text.match(/^(?:send\s+text\s+to|text)\s+(.+?)\s+saying\s+(.+)$/);
		if (m) return { name: m[1].trim(), message: m[2].trim() };
		return null;
	},
	async run(ctx, params) {
		const contact = await findContact(params.name);
		if (!contact) {
			await say(phrase('CONTACT_NOT_FOUND', { name: params.name }));
			return;
		}
		await sendSms(contact.number, params.message);
		await say(phrase('DIGEST_ITEM', { kind: 'sent', name: contact.name }));
	}
};