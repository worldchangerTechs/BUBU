const { say } = require('../audio');
const { phrase } = require('../personality');
const store = require('../store');

module.exports = {
	id: 'CLASS_STATUS',
	examples: ['class status', 'is there a class', 'any class today', 'do i have class'],
	match(text) {
		if (/\b(is there a class|any class today|class update|do i have class|class status)\b/.test(text)) return {};
		return null;
	},
	async run(ctx) {
		const classStatus = store.getClassStatus();
		if (!classStatus?.hasClass) {
			await say(phrase('CLASS_STATUS_EMPTY'));
			return;
		}
		await say(phrase('CLASS_STATUS', {
			title: classStatus.title,
			time: new Date(classStatus.time).toLocaleString()
		}));
	}
};