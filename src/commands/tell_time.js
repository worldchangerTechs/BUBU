const { say } = require('../audio');
const { phrase } = require('../personality');

module.exports = {
	id: 'TELL_TIME',
	examples: ['what time is it', 'tell me the time', 'current time'],
	match(text) {
		if (/\b(whats the time|what time is it|tell me the time|current time|time is it)\b/.test(text)) return {};
		return null;
	},
	async run(ctx) {
		const time = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
		await say(phrase('TELL_TIME', { time }));
	}
};