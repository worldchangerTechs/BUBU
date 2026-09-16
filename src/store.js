const fs = require('node:fs');
const path = require('node:path');

const STORE_PATH = path.join(__dirname, '..', 'store.json');

function defaultProfile() {
	return { learnedImportantWords: [], favoriteMoods: {}, frequentContacts: {} };
}

function normalizeProfile(raw) {
	const source = raw && typeof raw === 'object' ? raw : {};
	return {
		learnedImportantWords: Array.isArray(source.learnedImportantWords)
			? source.learnedImportantWords.filter((word) => typeof word === 'string')
			: [],
		favoriteMoods: source.favoriteMoods && typeof source.favoriteMoods === 'object'
			? source.favoriteMoods
			: {},
		frequentContacts: source.frequentContacts && typeof source.frequentContacts === 'object'
			? source.frequentContacts
			: {}
	};
}

function loadStore() {
	if (!fs.existsSync(STORE_PATH)) {
		return { events: [], digest: [], awayMode: false, lastSmsTimestamp: null, classStatus: null, profile: defaultProfile() };
	}

	const data = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
	return {
		events: Array.isArray(data.events) ? data.events : [],
		digest: Array.isArray(data.digest) ? data.digest : [],
		awayMode: data.awayMode === true,
		lastSmsTimestamp: data.lastSmsTimestamp || null,
		pendingReply: data.pendingReply || null,
		classStatus: data.classStatus || null,
		profile: normalizeProfile(data.profile)
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

function getLastSmsTimestamp() {
	return loadStore().lastSmsTimestamp;
}

function setLastSmsTimestamp(timestamp) {
	const store = loadStore();
	store.lastSmsTimestamp = timestamp;
	saveStore(store);
}

function setPendingReply({ channel, to, text }) {
	const store = loadStore();
	store.pendingReply = { channel, to, text };
	saveStore(store);
}

function getPendingReply() {
	return loadStore().pendingReply;
}

function clearPendingReply() {
	const store = loadStore();
	store.pendingReply = null;
	saveStore(store);
}

function setClassStatus(status) {
	const store = loadStore();
	store.classStatus = status && typeof status === 'object' ? status : null;
	saveStore(store);
}

function getClassStatus() {
	return loadStore().classStatus;
}

function getProfile() {
	return loadStore().profile;
}

function learnImportantWord(word) {
	const normalized = String(word || '').toLowerCase().trim();
	if (!normalized) {
		return [];
	}
	const store = loadStore();
	const existing = store.profile.learnedImportantWords.map((entry) => String(entry).toLowerCase());
	if (!existing.includes(normalized)) {
		store.profile.learnedImportantWords.push(normalized);
		saveStore(store);
	}
	return store.profile.learnedImportantWords;
}

function recordMoodTrack(moodKey, trackPath) {
	const mood = String(moodKey || '').toLowerCase().trim();
	const track = String(trackPath || '').trim();
	if (!mood || !track) {
		return null;
	}
	const store = loadStore();
	const entry = store.profile.favoriteMoods[mood];
	const counts = entry && typeof entry === 'object' && entry.tracks && typeof entry.tracks === 'object'
		? entry.tracks
		: {};
	counts[track] = (Number(counts[track]) || 0) + 1;
	store.profile.favoriteMoods[mood] = { tracks: counts };
	saveStore(store);
	return store.profile.favoriteMoods[mood];
}

function getPreferredTrack(moodKey, minimumPlays = 3) {
	const mood = String(moodKey || '').toLowerCase().trim();
	if (!mood) {
		return null;
	}
	const entry = loadStore().profile.favoriteMoods[mood];
	const tracks = entry && typeof entry === 'object' ? entry.tracks : null;
	if (!tracks || typeof tracks !== 'object') {
		return null;
	}
	let best = null;
	let bestPlays = minimumPlays;
	for (const [track, plays] of Object.entries(tracks)) {
		if (typeof track === 'string' && fs.existsSync(track) && Number(plays) >= bestPlays) {
			best = track;
			bestPlays = Number(plays);
		}
	}
	return best;
}

function recordFrequentContact(name) {
	const normalized = String(name || '').toLowerCase().trim();
	if (!normalized) {
		return null;
	}
	const store = loadStore();
	store.profile.frequentContacts[normalized] = (Number(store.profile.frequentContacts[normalized]) || 0) + 1;
	saveStore(store);
	return store.profile.frequentContacts[normalized];
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
	isAwayMode,
	getLastSmsTimestamp,
	setLastSmsTimestamp,
	setPendingReply,
	getPendingReply,
	clearPendingReply,
	setClassStatus,
	getClassStatus,
	getProfile,
	learnImportantWord,
	recordMoodTrack,
	getPreferredTrack,
	recordFrequentContact
};
