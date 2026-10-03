const { say } = require('../audio');
const { phrase } = require('../personality');
const { execFile } = require('node:child_process');
const { listenOnce } = require('../audio');

module.exports = {
	id: 'PAY_MPESA',
	examples: ['pay 100 to 254712345678', 'send 500 to 0712345678'],
	match(text) {
		const m = text.match(/^(?:pay|send)\s+([\d][\d\s,]*)\s+to\s+(\+?[\d][\d\s+\-]*)$/);
		if (m) {
			const amount = m[1].replace(/[\s,]/g, '');
			const number = m[2].replace(/[\s\-]/g, '');
			if (amount && number) return { amount, number };
		}
		return null;
	},
	async run(ctx, params) {
		await say(phrase('MPESA_CONFIRM', { amount: params.amount, number: params.number }));
		const confirmation = String(await listenOnce() || '').toLowerCase().trim();
		if (!/^(yes|yeah|yep|correct|right|confirm|sawa|ndio|eee|eh)$/.test(confirmation)
			&& !/\b(yes|yeah|yep|correct|thats right|that is right|confirm|sawa|ndio)\b/.test(confirmation)) {
			await say(phrase('MPESA_CANCELLED'));
			return;
		}
		await new Promise((resolve, reject) => {
			execFile('am', ['start', '-a', 'android.intent.action.CALL', '-d', 'tel:*334%23'], (error) => {
				if (error) reject(new Error(error.code === 'ENOENT' ? 'am unavailable' : `dialer failed: ${error.message}`));
				else resolve();
			});
		});
		await say(phrase('MPESA_OPEN'));
	}
};