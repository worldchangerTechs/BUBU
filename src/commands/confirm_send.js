const { say } = require('../audio');
const { phrase } = require('../personality');
const { sendMessage } = require('../whatsapp');
const { sendSms } = require('../termux/sms');
const store = require('../store');

module.exports = {
	id: 'CONFIRM_SEND',
	examples: ['send it', 'yes send', 'confirm send'],
	match(text) {
		if (/\b(?:send it|yes send|confirm send)\b/.test(text)) return {};
		return null;
	},
	async run(ctx) {
		const pendingReply = store.getPendingReply();
		if (!pendingReply) {
			await say("There's nothing to send");
			return;
		}
		if (pendingReply.channel === 'whatsapp') {
			await sendMessage(pendingReply.to, pendingReply.text);
		} else {
			await sendSms(pendingReply.to, pendingReply.text);
		}
		store.clearPendingReply();
		await say(phrase('REPLY_SENT'));
	}
};