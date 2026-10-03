const { say } = require('../audio');
const { phrase } = require('../personality');
const { searchGoogle } = require('../termux/appLauncher');

module.exports = {
	id: 'GOOGLE_SEARCH',
	examples: ['google search for cats', 'search for dogs', 'look up weather'],
	match(text) {
		const m = text.match(/^(?:google search for|search google for|look up|search for|google)\s+(.+)$/);
		if (m) {
			const query = m[1].trim();
			if (query) return { query };
		}
		return null;
	},
	async run(ctx, params) {
		try {
			await searchGoogle(params.query);
			await say(phrase('GOOGLE_SEARCH', { query: params.query }));
		} catch {
			await say("I'm sorry sir, but that is not possible for now.");
		}
	}
};