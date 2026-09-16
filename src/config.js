// Edit this file to configure the chats Bubu monitors and its away reply.
const WATCHED_CHATS = [
	'KSU IT WARRIORS COMMUNS GROUP (4.1)',
	// 'Example Study Group',
	// 'Example Family Chat'
];

const PRIORITY_SENDERS = ['baraka2024'];

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

// Optional owner phone number for WhatsApp pairing; leave blank to use QR linking.
const OWNER_PHONE_NUMBER = '';

const AWAY_AUTO_REPLY_TEXT = 'I am currently away and will get back to you soon.';

// Optional away-reply mode: use 'AI' for local LLM replies, or 'STATIC' for the fixed reply.
const AWAY_REPLY_MODE = 'AI';

module.exports = {
	WATCHED_CHATS,
	PRIORITY_SENDERS,
	IGNORE_CHAT_PATTERNS,
	IMPORTANT_KEYWORDS,
	OWNER_PHONE_NUMBER,
	AWAY_AUTO_REPLY_TEXT,
	AWAY_REPLY_MODE
};
