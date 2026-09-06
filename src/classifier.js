const {
	WATCHED_CHATS,
	IGNORE_CHAT_PATTERNS,
	IMPORTANT_KEYWORDS
} = require('./config');

function matchesAny(value, patterns) {
	const normalizedValue = typeof value === 'string' ? value.toLowerCase() : '';

	return patterns.some((pattern) =>
		normalizedValue.includes(String(pattern).toLowerCase())
	);
}

function classifyMessage(chatName, text) {
	if (matchesAny(chatName, WATCHED_CHATS)) {
		return 'CLASS';
	}

	if (matchesAny(chatName, IGNORE_CHAT_PATTERNS)) {
		return 'IGNORE';
	}

	if (matchesAny(text, IMPORTANT_KEYWORDS)) {
		return 'IMPORTANT';
	}

	return 'NORMAL';
}

module.exports = { classifyMessage };