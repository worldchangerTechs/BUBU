const { say } = require('../audio');
const store = require('../store');

module.exports = {
	id: 'SYSTEM_STATUS',
	examples: ['are you online', 'how are you doing', 'system status'],
	match(text) {
		if (/\b(are you online|how are you doing|system status)\b/i.test(text)) {
			return {};
		}
		return null;
	},
	async run() {
		const status = store.getBubuStatus();
		const coreIsOnline = status.core === 'ONLINE';
		const whatsappDown = status.whatsapp !== 'CONNECTED';

		if (coreIsOnline && whatsappDown) {
			await say("I'm up and running strong, sir — WhatsApp's connection is down right now, so I won't catch new class messages until it reconnects.");
			return;
		}

		if (coreIsOnline) {
			await say('All good, sir — fully connected.');
			return;
		}

		await say("I'm up and running strong, sir — the core system is online.");
	}
};
