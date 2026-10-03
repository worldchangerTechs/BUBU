require('dotenv').config();

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

// Cloud feature keys. When missing the corresponding cloud features are skipped.
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || '';
const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || '';
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';

// Local LLM paths. Required for AI replies; missing means rules-only mode.
const LLAMA_MODEL_PATH = process.env.LLAMA_MODEL_PATH || process.env.BUBU_LLM_MODEL || '';
const LLAMA_SERVER_BIN = process.env.LLAMA_SERVER_BIN || 'llama-server';

// PRIORITY_NUMBERS: manual override for priority sender phone numbers.
const PRIORITY_NUMBERS = (process.env.PRIORITY_NUMBERS || '')
	.split(',')
	.map((n) => n.trim())
	.filter(Boolean);

// DEBUG_SENDERS: log raw WhatsApp message identifiers for watched groups.
const DEBUG_SENDERS = process.env.DEBUG_SENDERS === '1';

function validateConfig() {
	const errors = [];
	const warnings = [];

	// Count how many .env variables were actually loaded.
	let loadedCount = 0;
	for (const key of Object.keys(process.env)) {
		if (key.startsWith('BUBU_') || key.startsWith('LLAMA_') || key.startsWith('ELEVENLABS_') || key.startsWith('ANTHROPIC_') || key.startsWith('PRIORITY_')) {
			loadedCount += 1;
		}
	}

	if (loadedCount === 0) {
		warnings.push('No configuration variables were loaded from .env; using defaults only.');
	}

	if (!ELEVENLABS_API_KEY) {
		warnings.push('ELEVENLABS_API_KEY is missing; ElevenLabs TTS will be skipped.');
	}
	if (!ELEVENLABS_VOICE_ID) {
		warnings.push('ELEVENLABS_VOICE_ID is missing; ElevenLabs TTS will be skipped.');
	}
	if (!ANTHROPIC_API_KEY) {
		warnings.push('ANTHROPIC_API_KEY is missing; Anthropic cloud AI will be skipped.');
	}

	const fs = require('node:fs');
	const os = require('node:os');

	if (!LLAMA_MODEL_PATH) {
		errors.push('LLAMA_MODEL_PATH is not set.');
	} else {
		const modelPath = LLAMA_MODEL_PATH.replace(/^~/, os.homedir());
		if (!fs.existsSync(modelPath)) {
			errors.push(`LLAMA_MODEL_PATH does not exist: ${LLAMA_MODEL_PATH}`);
		}
	}

	if (!LLAMA_SERVER_BIN) {
		errors.push('LLAMA_SERVER_BIN is not set.');
	} else {
		const binPath = LLAMA_SERVER_BIN.replace(/^~/, os.homedir());
		if (binPath.includes('/') || binPath.includes('\\')) {
			if (!fs.existsSync(binPath)) {
				errors.push(`LLAMA_SERVER_BIN does not exist: ${LLAMA_SERVER_BIN}`);
			}
		}
	}

	return { errors, warnings };
}

module.exports = {
	WATCHED_CHATS,
	PRIORITY_SENDERS,
	IGNORE_CHAT_PATTERNS,
	IMPORTANT_KEYWORDS,
	OWNER_PHONE_NUMBER,
	AWAY_AUTO_REPLY_TEXT,
	AWAY_REPLY_MODE,
	ELEVENLABS_API_KEY,
	ELEVENLABS_VOICE_ID,
	ANTHROPIC_API_KEY,
 LLAMA_MODEL_PATH,
 LLAMA_SERVER_BIN,
	PRIORITY_NUMBERS,
	DEBUG_SENDERS,
	validateConfig
};