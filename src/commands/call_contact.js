const { say } = require('../audio');
const { phrase } = require('../personality');
const { findContact } = require('../termux/contacts');
const { callContact } = require('../termux/appLauncher');

module.exports = {
	id: 'CALL_CONTACT',
	examples: ['call john', 'phone john', 'ring john', 'dial john'],
	match(text) {
		const m = text.match(/^(?:call|phone|ring|dial)\s+(.+)$/);
		if (m) {
			const name = m[1].trim();
			if (name && !/^(it|that|this|them|him|her|me|back)\s+off\b/.test(name)) {
				return { name };
			}
		}
		return null;
	},
	async run(ctx, params) {
		const contact = await findContact(params.name);
		if (!contact?.number) {
			await say("I couldn't find a contact matching that name");
			return;
		}
		await say(phrase('CALL_ANNOUNCE', { name: contact.name }));
		// Brief listen for cancellation
		const { listenOnce } = require('../audio');
		let objection = '';
		try {
			objection = await listenOnce();
		} catch {}
		if (/\bcancel\b|\bstop\b|\bno\b|\bdont\b/.test(String(objection).toLowerCase())) {
			await say(phrase('CALL_CANCELLED'));
			return;
		}
		try {
			await callContact(contact.number);
		} catch {
			await say("I'm sorry sir, but that is not possible for now.");
		}
	}
};