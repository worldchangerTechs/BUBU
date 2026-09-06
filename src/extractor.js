const chrono = require('chrono-node');

const TRIGGER_KEYWORDS = [
	'lecture',
	'class',
	'moved',
	'room',
	'postponed',
	'cancelled',
	'reschedule',
	'exam',
	'quiz',
	'deadline'
];

function extractEvent(messageText) {
	if (typeof messageText !== 'string') {
		return null;
	}

	const normalizedText = messageText.toLowerCase();
	const hasTriggerKeyword = TRIGGER_KEYWORDS.some((keyword) =>
		normalizedText.includes(keyword.toLowerCase())
	);

	if (!hasTriggerKeyword) {
		return null;
	}

	const dateResult = chrono.parse(messageText)[0];
	if (!dateResult) {
		return null;
	}

	const locationMatch = messageText.match(/\b(?:Room|Hall|Lab)\s+[A-Za-z0-9-]+\b/i);
	const title = messageText.slice(0, dateResult.index).replace(/\b(?:on|at|for|by|to)\s*$/i, '')
		+ ' ' + messageText.slice(dateResult.index + dateResult.text.length);

	return {
		raw: dateResult.text,
		date: dateResult.start.date(),
		title: title.replace(/\s+/g, ' ').replace(/\s+([,.!?])/g, '$1').trim(),
		location: locationMatch ? locationMatch[0] : null
	};
}

module.exports = { extractEvent, TRIGGER_KEYWORDS };
