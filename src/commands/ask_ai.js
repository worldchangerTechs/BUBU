const { say } = require('../audio');
const { complete } = require('../llmClient');
const { search } = require('../webSearch');
const { isTimeSensitive } = require('../personality');
const { CHAT_SYSTEM_PROMPT } = require('../personality');

const chatHistory = [];

module.exports = {
	id: 'ASK_AI',
	examples: ['tell me a joke', 'what is the capital of france', 'explain quantum physics'],
	match(text) {
		// This is the fallback - handled by registry.matchCommand returning CHAT
		return null;
	},
	async run(ctx, params) {
		const userText = String(params?.text ?? '').trim();
		if (!userText) {
			await say('I did not hear a question. Try saying that again.');
			return;
		}
		let promptUserText = userText;
		if (isTimeSensitive(userText)) {
			const results = await search(userText);
			if (results.length > 0) {
				const searchContext = results
					.slice(0, 3)
					.map((r, i) => `${i + 1}. ${r.title}\n${r.snippet}`)
					.join('\n');
				promptUserText = [
					`Original question: ${userText}`,
					'Search results:',
					searchContext,
					'Answer using only the information in the search results. If it is insufficient, say so clearly.'
				].join('\n');
			} else {
				promptUserText = `${userText}\n\nThis answer might not be current. Say so if you are uncertain.`;
			}
		}
		const prompt = [
			...chatHistory.map((e) => `${e.role === 'user' ? 'User' : 'Assistant'}: ${e.text}`),
			`User: ${promptUserText}`,
			'Assistant:'
		].join('\n');
		try {
			const reply = await complete(prompt, CHAT_SYSTEM_PROMPT);
			chatHistory.push({ role: 'user', text: userText }, { role: 'assistant', text: reply });
			if (chatHistory.length > 8) chatHistory.splice(0, chatHistory.length - 8);
			await say(reply);
		} catch {
			await say("I'm sorry sir, but that is not possible for now.");
		}
	}
};