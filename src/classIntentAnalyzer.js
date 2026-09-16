const { complete } = require('./llmClient');
const { TRIGGER_KEYWORDS } = require('./extractor');

const CLASS_INTENT_SYSTEM_PROMPT = [
	'Decide if this WhatsApp message is actually announcing, rescheduling, or cancelling a real class session - as opposed to just mentioning the word "class" in an unrelated way.',
	'Reply with exactly one word: YES or NO.'
].join(' ');

async function isRealClassMessage(text) {
	const messageText = String(text ?? '');
	if (!TRIGGER_KEYWORDS.some((keyword) => messageText.toLowerCase().includes(keyword.toLowerCase()))) {
		return false;
	}

	try {
		const response = await complete(messageText, CLASS_INTENT_SYSTEM_PROMPT);
		return /^YES\b/i.test(String(response).trim());
	} catch {
		return false;
	}
}

module.exports = { isRealClassMessage };