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

async function handleMessage() {
	// WhatsApp performs watched-message processing before invoking this callback.
}

module.exports = { recordMessage, getRecentMessages, handleMessage };
