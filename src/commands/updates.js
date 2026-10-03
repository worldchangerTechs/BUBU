const { say } = require('../audio');
const store = require('../store');

module.exports = {
	id: 'UPDATES',
	examples: ['give me the updates', "what's new", 'update me'],
	match(text) {
		if (/\b(give me the updates|what's new|what is new|update me)\b/i.test(text)) {
			return {};
		}
		return null;
	},
	async run() {
		const status = store.getBubuStatus();
		const classStatus = store.getClassStatus();
		const digest = store.getDigest();
		const lines = [];

		const hasStatusIssue = status.core !== 'ONLINE' || status.whatsapp !== 'CONNECTED' || status.llm === 'DOWN';
		if (hasStatusIssue) {
			if (status.core !== 'ONLINE') {
				lines.push('BUBU core is offline right now, sir.');
			} else if (status.whatsapp !== 'CONNECTED') {
				lines.push("WhatsApp's connection is down right now, sir.");
			}
			if (status.llm === 'DOWN') {
				lines.push('The local LLM is down, sir.');
			}
		}

		if (classStatus) {
			lines.push(`Class update: ${classStatus.title || 'There is a class'} at ${classStatus.time || 'the announced time'}.`);
		}

		if (digest.length) {
			lines.push(...digest.map((item) => item.text || 'Important update.'));
			store.clearDigest();
		}

		if (lines.length === 0) {
			await say("Everything's running smoothly, sir — no updates.");
			return;
		}

		await say(lines.join(' '));
	}
};
