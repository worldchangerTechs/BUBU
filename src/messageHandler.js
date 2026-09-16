const logger = require('./logger');
const { classifyMessage } = require('./classifier');
const { extractEvent } = require('./extractor');
const store = require('./store');
const { setAlarm } = require('./termux/alarm');
const { speakCloned } = require('./termux/cloudTts');
const { phrase } = require('./personality');
const { isRealClassMessage } = require('./classIntentAnalyzer');

const MAX_MESSAGES = 10;
const recentMessages = [];

function recordMessage(chatName, text, senderJid) {
	recentMessages.push({ chatName, text, senderJid, timestamp: new Date() });
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

async function handleMessage(chatName, text, senderJid, senderName) {
	const classification = classifyMessage(chatName, text, senderName);
	logger.info(`[message] [${chatName}] ${classification}`);

	if (classification === 'IGNORE') {
		return;
	}

	if (classification === 'CLASS') {
		logger.info(`[whatsapp] [${chatName}] ${text}`);
	}

	recordMessage(chatName, text, senderJid);

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

	if (!(await isRealClassMessage(text))) {
		logger.info(`[class] Ignored non-class message from [${chatName}]`);
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
		store.setClassStatus({
			hasClass: true,
			title: event.title,
			time: event.date,
			chatName,
			alarmSet: true,
			lastUpdated: Date.now()
		});
		await speakCloned(phrase('ALARM_SET', {
			title: event.title,
			time: new Date(event.date).toLocaleString()
		}));
	}
}

module.exports = { recordMessage, getRecentMessages, handleMessage };
