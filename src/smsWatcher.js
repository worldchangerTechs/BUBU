const { listSms } = require('./termux/sms');
const {
	getLastSmsTimestamp,
	setLastSmsTimestamp
} = require('./store');

const POLL_INTERVAL_MS = 30_000;
let watcherInterval = null;
let polling = false;

function timestampValue(timestamp) {
	const value = new Date(timestamp).getTime();
	return Number.isNaN(value) ? null : value;
}

async function pollSms(onNewSms) {
	if (polling) {
		return;
	}

	polling = true;
	try {
		const messages = await listSms(10);
		const storedTimestamp = timestampValue(getLastSmsTimestamp()) ?? -Infinity;
		const datedMessages = messages
			.map((message) => ({ message, timestamp: timestampValue(message.date) }))
			.filter(({ timestamp }) => timestamp !== null)
			.sort((first, second) => first.timestamp - second.timestamp);

		for (const { message, timestamp } of datedMessages) {
			if (timestamp > storedTimestamp) {
				await onNewSms(message.from, message.body);
			}
		}

		const newestTimestamp = datedMessages.at(-1)?.timestamp;
		if (newestTimestamp !== undefined) {
			setLastSmsTimestamp(new Date(newestTimestamp).toISOString());
		}
	} finally {
		polling = false;
	}
}

function startSmsWatcher(onNewSms) {
	if (typeof onNewSms !== 'function') {
		throw new TypeError('startSmsWatcher requires an onNewSms callback.');
	}
	if (watcherInterval) {
		return watcherInterval;
	}

	pollSms(onNewSms).catch(() => {});
	watcherInterval = setInterval(() => {
		pollSms(onNewSms).catch(() => {});
	}, POLL_INTERVAL_MS);
	return watcherInterval;
}

module.exports = { startSmsWatcher };