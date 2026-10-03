const { say } = require('../audio');
const { phrase } = require('../personality');
const store = require('../store');

module.exports = {
	id: 'AWAY_ON',
	examples: ['away mode on', 'i am away', 'set away'],
	match(text) {
		if (/\b(?:away mode on|i am away|im away|set away|away on)\b/.test(text)) return {};
		return null;
	},
	async run(ctx) {
		store.setAwayMode(true);
		await say(phrase('AWAY_ON'));
	}
};