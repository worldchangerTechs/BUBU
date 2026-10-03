const { say } = require('../audio');
const { phrase } = require('../personality');
const store = require('../store');

module.exports = {
	id: 'AWAY_OFF',
	examples: ['away mode off', 'i am back', 'away off'],
	match(text) {
		if (/\b(?:away mode off|i am back|im back|away off|back home)\b/.test(text)) return {};
		return null;
	},
	async run(ctx) {
		store.setAwayMode(false);
		await say(phrase('AWAY_OFF'));
	}
};