const { say } = require('../audio');
const { phrase } = require('../personality');
const { playForMood } = require('../moodMusic');
const { listenOnce } = require('../audio');

module.exports = {
	id: 'PLAY_MUSIC',
	examples: ['play music', 'play a song', 'play me something'],
	match(text) {
		if (/\b(play me something|play music|put on a song|play a song|play some music)\b/.test(text)) return {};
		return null;
	},
	async run(ctx) {
		await say(phrase('MUSIC_ASK_MOOD'));
		const moodText = await listenOnce();
		if (!String(moodText || '').trim()) {
			await say(phrase('MUSIC_MISSED_MOOD'));
			return;
		}
		const result = await playForMood(moodText);
		if (result?.source === 'local') {
			await say(phrase('MUSIC_LOCAL'));
			return;
		}
		await say(phrase('MUSIC_YOUTUBE'));
	}
};