const fs = require('node:fs');
const path = require('node:path');

const STORE_PATH = path.join(__dirname, '..', 'store.json');

function loadStore() {
	if (!fs.existsSync(STORE_PATH)) {
		return { events: [], digest: [], awayMode: false };
	}

	const data = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
	return {
		events: Array.isArray(data.events) ? data.events : [],
		digest: Array.isArray(data.digest) ? data.digest : [],
		awayMode: data.awayMode === true
	};
}

function saveStore(data) {
	fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function addEvent(event) {
	const store = loadStore();
	store.events.push(event);
	saveStore(store);
	return store.events;
}

function addDigestItem({ chatName, text, priority, timestamp }) {
	const store = loadStore();
	store.digest.push({ chatName, text, priority, timestamp });
	saveStore(store);
	return store.digest;
}

function getDigest() {
	const priorityOrder = { CLASS: 0, IMPORTANT: 1 };

	return loadStore().digest.sort((first, second) => {
		const priorityDifference = (priorityOrder[first.priority] ?? Number.MAX_SAFE_INTEGER)
			- (priorityOrder[second.priority] ?? Number.MAX_SAFE_INTEGER);
		if (priorityDifference !== 0) {
			return priorityDifference;
		}

		return new Date(second.timestamp).getTime() - new Date(first.timestamp).getTime();
	});
}

function clearDigest() {
	const store = loadStore();
	store.digest = [];
	saveStore(store);
}

function getNextEvent() {
	const now = Date.now();
	return loadStore().events
		.filter((event) => {
			const eventTime = new Date(event.date).getTime();
			return !Number.isNaN(eventTime) && eventTime > now;
		})
		.sort((first, second) => new Date(first.date) - new Date(second.date))[0] || null;
}

function setAwayMode(bool) {
	const store = loadStore();
	store.awayMode = Boolean(bool);
	saveStore(store);
}

function isAwayMode() {
	return loadStore().awayMode;
}

module.exports = {
	loadStore,
	saveStore,
	addEvent,
	addDigestItem,
	getDigest,
	clearDigest,
	getNextEvent,
	setAwayMode,
	isAwayMode
};
