const logger = require('./logger');
const { classifyMessage } = require('./classifier');
const { extractEvent } = require('./extractor');
const store = require('./store');
const { setAlarm } = require('./termux/alarm');
const { speakCloned } = require('./termux/cloudTts');

const MAX_MESSAGES = 10;
const recentMessages = [];

function recordMessage(chatName, text) {
	recentMessages.push({ chatName, text, timestamp: new Date() });
	if (recentMessages.length > MAX_MESSAGES) {
		recentMessages.shift();
	}
}

function getRecentMessages(limit = MAX_MESSAGES) {
	const requestedLimit = Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : MAX_MESSAGES;
	if (requestedLimit === 0) {
		return [];
	}
	return recentMessages.slice(-requestedLimit);
}

async function handleMessage(chatName, text) {
	const classification = classifyMessage(chatName, text);
	logger.info(`[message] [${chatName}] ${classification}`);

	if (classification === 'IGNORE') {
		return;
	}

	if (classification === 'CLASS') {
		logger.info(`[whatsapp] [${chatName}] ${text}`);
	}

	recordMessage(chatName, text);

	if (classification === 'IMPORTANT') {
		store.addDigestItem({
			chatName,
			text,
			priority: 'IMPORTANT',
			timestamp: new Date()
		});
		return;
	}

	if (classification !== 'CLASS') {
		return;
	}

	store.addDigestItem({
		chatName,
		text,
		priority: 'CLASS',
		timestamp: new Date()
	});
	const event = extractEvent(text);
	if (event) {
		store.addEvent(event);
		await setAlarm(event.date, event.title);
		await speakCloned(`New alarm set: ${event.title}`);
	}
}

module.exports = { recordMessage, getRecentMessages, handleMessage };
