// Edit this file to configure the chats Bubu monitors and its away reply.
const WATCHED_CHATS = [
	// 'Example Study Group',
	// 'Example Family Chat'
];

// User-editable keywords for chats to always ignore.
const IGNORE_CHAT_PATTERNS = [
	'marketplace',
	'buy and sell',
	'for sale',
	'promo',
	'deals',
	'classifieds'
];

// User-editable keywords for messages that should always be treated as important.
const IMPORTANT_KEYWORDS = [
	'urgent',
	'asap',
	'emergency',
	'interview',
	'deadline',
	'payment due',
	'important',
	'reminder'
];

const AWAY_AUTO_REPLY_TEXT = 'I am currently away and will get back to you soon.';

module.exports = {
	WATCHED_CHATS,
	IGNORE_CHAT_PATTERNS,
	IMPORTANT_KEYWORDS,
	AWAY_AUTO_REPLY_TEXT
};
