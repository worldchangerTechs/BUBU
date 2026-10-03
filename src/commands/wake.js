const { phrase } = require('../personality');
const { say } = require('../audio');

module.exports = {
	id: 'WAKE',
	examples: ['hello', 'hi bubu', 'hey bubu', 'ok bubu'],
	match(text) {
		if (/^(?:hello|hi|hey)(?:\s+bubu)?$/.test(text) || /^(?:hello bubu|hi bubu|hey bubu|ok bubu|hey booboo)$/.test(text)) {
			return {};
		}
		return null;
	},
	async run(ctx) {
		await say(phrase('WAKE'));
	}
};