const { say } = require('../audio');
const { phrase } = require('../personality');
const store = require('../store');

module.exports = {
	id: 'TEACH_ALIAS',
	examples: ['when i say nxt class i mean next class', 'when i say watsup i mean hello'],
	match(text) {
		const m = text.match(/^when i say\s+(.+?)\s+i mean\s+(.+)$/);
		if (m) return { alias: m[1].trim(), target: m[2].trim() };
		return null;
	},
	async run(ctx, params) {
		if (!params.alias || !params.target) {
			await say("I'm sorry sir, but that is not possible for now.");
			return;
		}
		const profile = store.getProfile();
		if (!profile.aliases) profile.aliases = {};
		profile.aliases[params.alias.toLowerCase()] = params.target;
		store.saveStore({ ...store.loadStore(), profile });
		await say(`Got it — when you say "${params.alias}", I'll treat it as "${params.target}".`);
	}
};