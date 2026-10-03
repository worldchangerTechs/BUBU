const { say } = require('../audio');
const { phrase } = require('../personality');
const { complete } = require('../llmClient');
const { search } = require('../webSearch');
const { isTimeSensitive } = require('../personality');
const store = require('../store');

module.exports = {
	id: 'REPLY_DRAFT',
	examples: ['help me reply to john', 'draft a reply to john'],
	match(text) {
		const m = text.match(/^(?:help me|draft a) reply to\s+(.+)$/);
		if (m) return { name: m[1].trim() };
		return null;
	},
	async run(ctx, params) {
		const { findWhatsAppMessage, findSmsMessage } = require('../voiceRouter');
		const whatsappMessage = findWhatsAppMessage(params.name);
		let source = whatsappMessage;
		let channel = 'whatsapp';
		if (!source) {
			source = await findSmsMessage(params.name);
			channel = 'sms';
		}
		if (!source) {
			await say(phrase('CONTACT_NOT_FOUND', { name: params.name }));
			return;
		}
		const draft = await complete(`Message from ${params.name}: ${source.text || source.body}`, require('../personality').REPLY_DRAFT_SYSTEM_PROMPT);
		const recipient = channel === 'whatsapp' ? source.senderJid || source.chatName : source.from;
		store.setPendingReply({ channel, to: recipient, text: draft });
		await say(`${phrase('REPLY_DRAFT')} ${draft}`);
	}
};