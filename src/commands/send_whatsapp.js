const { say } = require('../audio');
const { phrase } = require('../personality');
const { toWhatsAppJid } = require('../whatsapp');
const { findContact } = require('../termux/contacts');
const { sendMessage } = require('../whatsapp');

module.exports = {
	id: 'SEND_WHATSAPP',
	examples: ['whatsapp john saying hello', 'send whatsapp to john saying hi'],
	match(text) {
		const m = text.match(/^(?:whatsapp\s+(.+?)\s+saying\s+(.+)|send(?:\s+a)?\s+whatsapp\s+to\s+(.+?)\s+saying\s+(.+))$/);
		if (m) {
			const name = (m[1] || m[3] || '').trim();
			const message = (m[2] || m[4] || '').trim();
			if (name && message) return { name, message };
		}
		return null;
	},
	async run(ctx, params) {
		const contact = await findContact(params.name);
		if (!contact?.number) {
			await say(phrase('CONTACT_NOT_FOUND', { name: params.name }));
			return;
		}
		try {
			await sendMessage(toWhatsAppJid(contact.number), params.message);
			await say(phrase('WHATSAPP_SENT', { name: contact.name }));
		} catch {
			await say("I'm sorry sir, but that is not possible for now.");
		}
	}
};