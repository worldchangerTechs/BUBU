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

// Optional owner phone number for WhatsApp pairing; leave blank to use QR linking.
// Env override wins so Termux setups can keep the number out of git:
//   BUBU_OWNER_PHONE=+2547XXXXXXXX node src/index.js
const OWNER_PHONE_NUMBER = process.env.BUBU_OWNER_PHONE || '';

const AWAY_AUTO_REPLY_TEXT = 'I am currently away and will get back to you soon.';

// Optional away-reply mode: use 'AI' for local LLM replies, or 'STATIC' for the fixed reply.
const AWAY_REPLY_MODE = 'STATIC';

module.exports = {
	WATCHED_CHATS,
	IGNORE_CHAT_PATTERNS,
	IMPORTANT_KEYWORDS,
	OWNER_PHONE_NUMBER,
	AWAY_AUTO_REPLY_TEXT,
	AWAY_REPLY_MODE
};
