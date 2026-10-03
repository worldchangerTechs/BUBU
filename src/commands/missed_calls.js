const { say } = require('../audio');
const { phrase } = require('../personality');
const { getMissedCalls } = require('../termux/callLog');

module.exports = {
	id: 'MISSED_CALLS',
	examples: ['missed calls', 'who called', 'missed call'],
	match(text) {
		if (/\bmissed calls?\b|\bwho called\b/.test(text)) return {};
		return null;
	},
	async run(ctx) {
		const calls = await getMissedCalls(3);
		for (const call of calls) {
			await say(phrase('DIGEST_ITEM', { ...call, kind: 'call' }));
		}
	}
};