const { say } = require('../audio');
const { phrase } = require('../personality');
const store = require('../store');

module.exports = {
	id: 'NEXT_CLASS',
	examples: ['next class', 'next lecture', 'what is my next class'],
	match(text) {
		if (/^when i say\b/.test(text)) return null;
		if (/\b(?:next class|next lecture)\b/.test(text)) return {};
		return null;
	},
	async run(ctx) {
		const event = store.getNextEvent();
		if (!event) {
			await say(phrase('DIGEST_EMPTY'));
			return;
		}
		const eventDate = new Date(event.date);
		await say(phrase('DIGEST_ITEM', {
			kind: 'nextClass',
			title: event.title,
			time: eventDate.toLocaleString()
		}));
	}
};