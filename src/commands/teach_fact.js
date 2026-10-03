const { say } = require('../audio');
const { phrase } = require('../personality');
const store = require('../store');

module.exports = {
	id: 'TEACH_FACT',
	examples: ['remember that john likes coffee', 'remember that the meeting is at 3pm'],
	match(text) {
		const m = text.match(/^remember that\s+(.+)$/);
		if (m) return { fact: m[1].trim() };
		return null;
	},
	async run(ctx, params) {
		if (!params.fact) {
			await say("I'm sorry sir, but that is not possible for now.");
			return;
		}
		// Store as a fact in profile
		const profile = store.getProfile();
		if (!profile.facts) profile.facts = [];
		profile.facts.push(params.fact);
		// Keep only last 50 facts
		if (profile.facts.length > 50) profile.facts = profile.facts.slice(-50);
		store.saveStore({ ...store.loadStore(), profile });
		await say(phrase('TEACH_SAVED', { fact: params.fact }));
	}
};