const fs = require('node:fs');
const path = require('node:path');

const STORE_PATH = path.join(__dirname, '..', 'store.json');

function defaultBubuStatus() {
	return {
		core: 'OFFLINE',
		llm: 'LOCAL',
		whatsapp: 'DISCONNECTED'
	};
}

function defaultProfile() {
	return {
		facts: [],
		aliases: {},
		favoriteMoods: {},
		frequentContacts: {},
		learnedImportantWords: []
	};
}

function normalizeProfile(raw) {
	const source = raw && typeof raw === 'object' ? raw : {};
	return {
		facts: Array.isArray(source.facts)
			? source.facts.filter((f) => typeof f === 'string')
			: [],
		aliases: source.aliases && typeof source.aliases === 'object'
			? source.aliases
			: {},
		favoriteMoods: source.favoriteMoods && typeof source.favoriteMoods === 'object'
			? source.favoriteMoods
			: {},
		frequentContacts: source.frequentContacts && typeof source.frequentContacts === 'object'
			? source.frequentContacts
			: {},
		learnedImportantWords: Array.isArray(source.learnedImportantWords)
			? source.learnedImportantWords.filter((word) => typeof word === 'string')
			: []
	};
}

function loadStore() {
	if (!fs.existsSync(STORE_PATH)) {
		return {
			events: [],
			digest: [],
			awayMode: false,
			lastSmsTimestamp: null,
			pendingReply: null,
			classStatus: null,
			pendingAlarms: [],
			recentAlarms: [],
			bubuStatus: defaultBubuStatus(),
			profile: defaultProfile()
		};
	}

	try {
		const data = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
		return {
			events: Array.isArray(data.events) ? data.events : [],
			digest: Array.isArray(data.digest) ? data.digest : [],
			awayMode: data.awayMode === true,
			lastSmsTimestamp: data.lastSmsTimestamp || null,
			pendingReply: data.pendingReply || null,
			classStatus: data.classStatus || null,
			pendingAlarms: Array.isArray(data.pendingAlarms) ? data.pendingAlarms : [],
			recentAlarms: Array.isArray(data.recentAlarms) ? data.recentAlarms : [],
			bubuStatus: { ...defaultBubuStatus(), ...(data.bubuStatus || {}) },
			profile: normalizeProfile(data.profile)
		};
	} catch {
		return {
			events: [],
			digest: [],
			awayMode: false,
			lastSmsTimestamp: null,
			pendingReply: null,
			classStatus: null,
			pendingAlarms: [],
			recentAlarms: [],
			bubuStatus: defaultBubuStatus(),
			profile: defaultProfile()
		};
	}
}

function saveStore(data) {
	try {
		fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2) + '\n', 'utf8');
	} catch {
		// ignore
	}
}

function addEvent(event) {
	const store = loadStore();
	store.events.push(event);
	saveStore(store);
	return store.events;
}

function addDigestItem({ chatName, text, priority, timestamp }) {
	const store = loadStore();
	store.digest.push({ chatName, text, priority, timestamp: timestamp || new Date().toISOString() });
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

function setPendingReply(reply) {
	const store = loadStore();
	store.pendingReply = reply && typeof reply === 'object' ? reply : null;
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
	store.classStatus = status && typeof status === 'object' ? { ...status, updatedAt: Date.now() } : null;
	saveStore(store);
}

function getClassStatus() {
	const status = loadStore().classStatus;
	if (!status) return null;
	if (status.time) {
		const eventTime = new Date(status.time).getTime();
		// Treat as expired 2 hours after event time
		if (!Number.isNaN(eventTime) && Date.now() - eventTime > 2 * 3600 * 1000) {
			return null;
		}
	}
	return status;
}

function setBubuStatus(status) {
	const next = { ...defaultBubuStatus(), ...loadStore().bubuStatus, ...(status || {}) };
	const store = loadStore();
	store.bubuStatus = next;
	saveStore(store);
	return next;
}

function getBubuStatus() {
	return { ...defaultBubuStatus(), ...(loadStore().bubuStatus || {}) };
}

function getProfile() {
	return loadStore().profile;
}

function addFact(fact) {
	const trimmed = String(fact ?? '').trim();
	if (!trimmed) return;
	const store = loadStore();
	if (!store.profile.facts.includes(trimmed)) {
		store.profile.facts.push(trimmed);
		saveStore(store);
	}
}

function removeFact(query) {
	const q = String(query ?? '').trim().toLowerCase();
	if (!q) return false;
	const store = loadStore();
	const initialLen = store.profile.facts.length;
	store.profile.facts = store.profile.facts.filter((f) => !f.toLowerCase().includes(q));
	saveStore(store);
	return store.profile.facts.length < initialLen;
}

function getTopFacts(maxChars = 400) {
	const facts = loadStore().profile.facts.slice(0, 10);
	const result = [];
	let chars = 0;
	for (const f of facts) {
		if (chars + f.length + 1 <= maxChars) {
			result.push(f);
			chars += f.length + 1;
		}
	}
	return result;
}

function setAlias(alias, target) {
	const a = String(alias ?? '').trim().toLowerCase();
	const t = String(target ?? '').trim();
	if (!a || !t) return;
	const store = loadStore();
	store.profile.aliases[a] = t;
	saveStore(store);
}

function getAliases() {
	return loadStore().profile.aliases || {};
}

// Alarm correctness and dedupe
function isAlarmDuplicate(dateObj) {
	if (!dateObj) return false;
	const d = new Date(dateObj);
	if (Number.isNaN(d.getTime())) return false;
	const store = loadStore();
	const twelveHoursAgo = Date.now() - 12 * 3600 * 1000;

	// Purge older than 12h
	const recent = (store.recentAlarms || []).filter((a) => a.createdAt > twelveHoursAgo);
	if (recent.length !== (store.recentAlarms || []).length) {
		store.recentAlarms = recent;
		saveStore(store);
	}

	const dateStr = d.toDateString();
	const hour = d.getHours();
	const minute = d.getMinutes();

	return recent.some((a) => a.date === dateStr && a.hour === hour && a.minute === minute);
}

function recordAlarm(dateObj, title) {
	const d = new Date(dateObj);
	if (Number.isNaN(d.getTime())) return;
	const store = loadStore();
	if (!Array.isArray(store.recentAlarms)) store.recentAlarms = [];
	store.recentAlarms.push({
		date: d.toDateString(),
		hour: d.getHours(),
		minute: d.getMinutes(),
		title: title || '',
		createdAt: Date.now()
	});
	saveStore(store);
}

function addPendingAlarm(alarm) {
	const store = loadStore();
	if (!Array.isArray(store.pendingAlarms)) store.pendingAlarms = [];
	store.pendingAlarms.push({
		...alarm,
		createdAt: Date.now()
	});
	saveStore(store);
}

function getPendingAlarms() {
	return loadStore().pendingAlarms || [];
}

function removePendingAlarm(index) {
	const store = loadStore();
	if (Array.isArray(store.pendingAlarms) && store.pendingAlarms[index]) {
		store.pendingAlarms.splice(index, 1);
		saveStore(store);
	}
}

function setPendingAlarms(list) {
	const store = loadStore();
	store.pendingAlarms = Array.isArray(list) ? list : [];
	saveStore(store);
}

function learnImportantWord(word) {
	const normalized = String(word || '').toLowerCase().trim();
	if (!normalized) return [];
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
	if (!mood || !track) return null;
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
	if (!mood) return null;
	const entry = loadStore().profile.favoriteMoods[mood];
	const tracks = entry && typeof entry === 'object' ? entry.tracks : null;
	if (!tracks || typeof tracks !== 'object') return null;
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
	if (!normalized) return null;
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
	setBubuStatus,
	getBubuStatus,
	getProfile,
	addFact,
	removeFact,
	getTopFacts,
	setAlias,
	getAliases,
	isAlarmDuplicate,
	recordAlarm,
	addPendingAlarm,
	getPendingAlarms,
	removePendingAlarm,
	setPendingAlarms,
	learnImportantWord,
	recordMoodTrack,
	getPreferredTrack,
	recordFrequentContact
};
