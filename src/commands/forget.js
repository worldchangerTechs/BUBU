const { say } = require('../audio');
const store = require('../store');

module.exports = {
	id: 'FORGET',
	examples: ['forget that john likes coffee', 'forget the meeting is at 3pm'],
	match(text) {
		const m = text.match(/^forget\s+(.+)$/);
		if (m) return { fact: m[1].trim() };
		return null;
	},
	async run(ctx, params) {
		if (!params.fact) {
			await say("I'm sorry sir, but that is not possible for now.");
			return;
		}
		const profile = store.getProfile();
		if (profile.facts) {
			const idx = profile.facts.findIndex((f) => f.toLowerCase() === params.fact.toLowerCase());
			if (idx !== -1) {
				profile.facts.splice(idx, 1);
				store.saveStore({ ...store.loadStore(), profile });
				await say(`Forgot: ${params.fact}`);
				return;
			}
		}
		// Also check aliases
		if (profile.aliases) {
			const key = params.fact.toLowerCase();
			if (profile.aliases[key]) {
				delete profile.aliases[key];
				store.saveStore({ ...store.loadStore(), profile });
				await say(`Forgot alias: ${params.fact}`);
				return;
			}
		}
		await say(`I couldn't find "${params.fact}" to forget.`);
	}
};