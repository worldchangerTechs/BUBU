const { say } = require('../audio');
const { phrase } = require('../personality');
const store = require('../store');

module.exports = {
	id: 'READ_IMPORTANT',
	examples: ['read important', 'important messages', 'what did i miss'],
	match(text) {
		if (/\bread (?:my )?important messages?\b|\bwhat did i miss\b|\bimportant messages?\b/.test(text)) return {};
		return null;
	},
	async run(ctx) {
		const digest = store.getDigest();
		if (digest.length === 0) {
			await say(phrase('DIGEST_EMPTY'));
			return;
		}
		for (const item of digest) {
			const label = item.priority === 'CLASS' ? 'Class' : 'Important';
			await say(phrase('DIGEST_ITEM', { ...item, priority: label }));
		}
		store.clearDigest();
	}
};