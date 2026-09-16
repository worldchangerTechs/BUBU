const {
	WATCHED_CHATS,
	PRIORITY_SENDERS,
	IGNORE_CHAT_PATTERNS,
	IMPORTANT_KEYWORDS
} = require('./config');
const { getProfile } = require('./store');

function matchesAny(value, patterns) {
	const normalizedValue = typeof value === 'string' ? value.toLowerCase() : '';

	return patterns.some((pattern) =>
		normalizedValue.includes(String(pattern).toLowerCase())
	);
}

// Learned words ADD to the config.js list at runtime — never replace it.
// They only grow from explicit TEACH commands, never from inference.
function effectiveImportantKeywords() {
	let learned = [];
	try {
		learned = getProfile().learnedImportantWords || [];
	} catch {
		learned = [];
	}
	return [...IMPORTANT_KEYWORDS, ...learned];
}

function classifyMessage(chatName, text, senderName) {
	if (matchesAny(chatName, WATCHED_CHATS) || matchesAny(senderName, PRIORITY_SENDERS)) {
		return 'CLASS';
	}

	if (matchesAny(chatName, IGNORE_CHAT_PATTERNS)) {
		return 'IGNORE';
	}

	if (matchesAny(text, effectiveImportantKeywords())) {
		return 'IMPORTANT';
	}

	return 'NORMAL';
}

module.exports = { classifyMessage, effectiveImportantKeywords };