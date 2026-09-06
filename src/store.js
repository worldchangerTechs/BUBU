const fs = require('node:fs');
const path = require('node:path');

const STORE_PATH = path.join(__dirname, '..', 'store.json');

function loadStore() {
	if (!fs.existsSync(STORE_PATH)) {
		return { events: [], awayMode: false };
	}

	const data = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
	return {
		events: Array.isArray(data.events) ? data.events : [],
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
	getNextEvent,
	setAwayMode,
	isAwayMode
};
