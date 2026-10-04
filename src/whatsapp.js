const fs = require('node:fs');
const path = require('node:path');
const { log, silentLogger } = require('./logger');
const {
	WATCHED_CHATS,
	PRIORITY_SENDERS,
	PRIORITY_NUMBERS,
	DEBUG_SENDERS,
	AWAY_AUTO_REPLY_TEXT,
	AWAY_REPLY_MODE
} = require('./config');
const { AWAY_REPLY_SYSTEM_PROMPT } = require('./personality');
const store = require('./store');
const { isOnline } = require('./net');
const { say } = require('./audio');

function updateWhatsappStatus(status) {
	const current = store.getBubuStatus();
	store.setBubuStatus({ ...current, whatsapp: status });
}

const AUTH_DIR = path.join(__dirname, '..', 'auth_info');
let socket = null;
let pairingRequested = false;
let reconnectTimer = null;
let reconnectAttempts = 0;
let lastReconnectAttemptAt = 0;
let hasGreeted = false;
const MAX_RECONNECT_DELAY_MS = 60000;
const autoRepliedSenders = new Set();
const groupSubjectCache = new Map();
const seenMessageIds = new Map(); // LRU cache of 500 IDs
const priorityDigitsSet = new Set((PRIORITY_NUMBERS || []).map((n) => String(n).replace(/\D/g, '').slice(-9)));

let baileysPromise = null;
async function getBaileys() {
	if (!baileysPromise) {
		baileysPromise = import('@whiskeysockets/baileys');
	}
	return baileysPromise;
}

function resolvePriorityContacts() {
	if (process.env.BUBU_MOCK_TERMUX === '1') return;
	const { execFile } = require('node:child_process');
	execFile('termux-contact-list', [], { timeout: 4000 }, (err, stdout) => {
		if (!err && stdout) {
			try {
				const contacts = JSON.parse(stdout);
				for (const c of contacts) {
					const name = c.name || '';
					if (PRIORITY_SENDERS.some((ps) => name.toLowerCase().includes(ps.toLowerCase()))) {
						const num = c.number || '';
						const digits = num.replace(/\D/g, '');
						if (digits.length >= 9) {
							priorityDigitsSet.add(digits.slice(-9));
						}
					}
				}
			} catch {}
		}
	});
}

function normalizePhoneNumber(phoneNumber) {
	return String(phoneNumber || '').replace(/\D/g, '');
}

function clearReconnectTimer() {
	if (reconnectTimer) {
		clearTimeout(reconnectTimer);
		reconnectTimer = null;
	}
}

function scheduleReconnect(onMessage, onConnected, phoneNumber) {
	if (reconnectTimer) return;
	reconnectAttempts += 1;
	// Exponential backoff 2, 4, 8, ... capped at 60s with jitter, with an enforced 2s minimum gap
	// between reconnect attempts to avoid the reconnect storm that previously crowded the event loop.
	const baseDelay = Math.min(2000 * Math.pow(2, reconnectAttempts - 1), MAX_RECONNECT_DELAY_MS);
	const jitter = Math.floor(Math.random() * 1000);
	let delayMs = Math.min(baseDelay + jitter, MAX_RECONNECT_DELAY_MS);
	const now = Date.now();
	const elapsedSinceLastConnectAttempt = now - lastReconnectAttemptAt;
	if (elapsedSinceLastConnectAttempt < 2000) {
		delayMs += 2000 - elapsedSinceLastConnectAttempt;
	}
	lastReconnectAttemptAt = now + delayMs;

	log.info(`[whatsapp] Reconnecting in ${Math.round(delayMs / 1000)}s (attempt ${reconnectAttempts})...`);
	reconnectTimer = setTimeout(() => {
		reconnectTimer = null;
		connectWhatsApp(onMessage, onConnected, phoneNumber).catch((error) => {
			log.error(`[whatsapp] Reconnect failed: ${error.message}`);
		});
	}, delayMs);
}

function getMessageText(message) {
	return message?.conversation
		|| message?.extendedTextMessage?.text
		|| message?.imageMessage?.caption
		|| message?.videoMessage?.caption
		|| message?.documentWithCaptionMessage?.message?.documentMessage?.caption
		|| '';
}

function isDuplicateMessage(msgId) {
	if (!msgId) return false;
	if (seenMessageIds.has(msgId)) return true;
	seenMessageIds.set(msgId, Date.now());
	if (seenMessageIds.size > 500) {
		const oldest = seenMessageIds.keys().next().value;
		seenMessageIds.delete(oldest);
	}
	return false;
}

async function maybeSendAwayReply(isDirectMessage, senderJid, messageText) {
	if (!isDirectMessage || !store.isAwayMode()) {
		return;
	}
	if (autoRepliedSenders.has(senderJid)) {
		return;
	}

	try {
		let replyText = AWAY_AUTO_REPLY_TEXT;
		if (AWAY_REPLY_MODE === 'AI') {
			try {
				const { complete } = require('./llmClient');
				replyText = await complete(messageText, AWAY_REPLY_SYSTEM_PROMPT, { stream: false });
			} catch (error) {
				log.warn(`[whatsapp] AI away reply unavailable: ${error.message}; using static reply.`);
			}
		}

		await sendMessage(senderJid, replyText);
		autoRepliedSenders.add(senderJid);
	} catch (error) {
		log.error(`[whatsapp] Away reply failed: ${error.message}`);
	}
}

function writeGroupsLog(entries) {
	if (!entries || entries.length === 0) return;
	const target = path.join(__dirname, '..', 'groups.log');
	const text = entries.map((entry) => `${entry.subject} (${entry.id})`).join('\n') + '\n';
	const stream = fs.createWriteStream(target, { flags: 'a' });
	stream.on('error', () => {});
	stream.write(text);
	stream.end();
}

async function connectWhatsApp(onMessage, onConnected, phoneNumber) {
	clearReconnectTimer();
	updateWhatsappStatus('CONNECTING');

	const baileys = await getBaileys();
	const makeWASocket = baileys.default || baileys.makeWASocket;
	const { useMultiFileAuthState, DisconnectReason, Browsers } = baileys;

	const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

	const sock = makeWASocket({
		auth: state,
		logger: silentLogger,
		printQRInTerminal: !phoneNumber,
		browser: Browsers.ubuntu('Chrome'),
		defaultQueryTimeoutMs: 60000
	});
	socket = sock;

	sock.ev.on('creds.update', saveCreds);

	sock.ev.on('connection.update', async (update) => {
		const { connection, lastDisconnect } = update;

		if (connection === 'open') {
			reconnectAttempts = 0;
			updateWhatsappStatus('CONNECTED');
			log.info('[whatsapp] Connected!');

			// Cache group subjects on open
			try {
				const groups = await sock.groupFetchAllParticipating();
				const discovered = [];
				for (const [jid, metadata] of Object.entries(groups)) {
					if (metadata?.subject) {
						const entry = { id: jid, subject: metadata.subject };
						if (!groupSubjectCache.has(jid)) {
							discovered.push(entry);
						}
						groupSubjectCache.set(jid, metadata.subject);
					}
				}
				if (discovered.length > 0) {
					log.info(`[whatsapp] Discovered ${discovered.length} groups during startup.`);
					writeGroupsLog(discovered);
				}
			} catch (err) {
				log.warn(`[whatsapp] Failed to fetch participating groups: ${err.message}`);
			}

			// Resolve priority contacts
			resolvePriorityContacts();

			// Startup greeting is intentionally handled by the boot sequence, not by WhatsApp.
			hasGreeted = true;
			onConnected?.();
		}

		if (connection === 'close') {
			const statusCode = lastDisconnect?.error?.output?.statusCode;
			const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

			if (statusCode === DisconnectReason.loggedOut) {
				updateWhatsappStatus('NOT_LINKED');
				log.error('[whatsapp] WhatsApp was unlinked. Delete auth_info and pair again.');
				say('WhatsApp was unlinked, sir. Delete auth_info and pair again.');
				return;
			}

			updateWhatsappStatus('DISCONNECTED');
			log.warn(`[whatsapp] Connection closed (code ${statusCode || 'unknown'}). Scheduling reconnect...`);
			try { sock.end(undefined); } catch {}
			scheduleReconnect(onMessage, onConnected, phoneNumber);
		}
	});

	// Pairing code logic: call at most once per process, 3s after socket starts, only when not registered
	if (phoneNumber && !state.creds.registered && !pairingRequested) {
		pairingRequested = true;
		setTimeout(async () => {
			try {
				const normalized = normalizePhoneNumber(phoneNumber);
				log.info(`[whatsapp] Requesting pairing code for ${normalized}...`);
				const code = await sock.requestPairingCode(normalized);
				log.info(`[whatsapp] === Link WhatsApp with this code: ${code} ===`);
				try {
					const { setStatus } = require('./hud/terminalHud');
					setStatus(`Link code: ${code}`);
				} catch {}
			} catch (err) {
				log.error(`[whatsapp] Pairing code request failed: ${err.message}`);
			}
		}, 3000);
	}

	// Update cached group subjects on groups.upsert and groups.update
	sock.ev.on('groups.upsert', (groups) => {
		const discovered = [];
		for (const g of groups) {
			if (g?.id && g?.subject) {
				if (!groupSubjectCache.has(g.id)) {
					discovered.push({ id: g.id, subject: g.subject });
				}
				groupSubjectCache.set(g.id, g.subject);
			}
		}
		if (discovered.length > 0) {
			log.info(`[whatsapp] Discovered ${discovered.length} new groups.`);
			writeGroupsLog(discovered);
		}
	});

	sock.ev.on('groups.update', (updates) => {
		for (const u of updates) {
			if (u?.id && u?.subject) {
				groupSubjectCache.set(u.id, u.subject);
			}
		}
	});

	// Message filtering and handling
	sock.ev.on('messages.upsert', async ({ messages, type }) => {
		if (type !== 'notify') return;

		for (const message of messages) {
			const remoteJid = message.key?.remoteJid || '';

			// S6 Message filtering before anything else
			if (
				!remoteJid ||
				remoteJid.endsWith('@newsletter') ||
				remoteJid === 'status@broadcast' ||
				remoteJid.endsWith('@broadcast') ||
				message.key?.fromMe
			) {
				continue;
			}

			// Dedupe by key.id with 500 LRU
			if (isDuplicateMessage(message.key?.id)) {
				continue;
			}

			const isGroup = remoteJid.endsWith('@g.us');
			const chatName = isGroup ? (groupSubjectCache.get(remoteJid) || remoteJid) : (message.pushName || remoteJid.replace('@s.whatsapp.net', ''));
			const messageText = getMessageText(message.message);
			const senderJid = message.key?.participant || remoteJid;
			const pushName = message.pushName || '';

			// DEBUG_SENDERS: log raw identifiers from watched groups
			if (DEBUG_SENDERS && WATCHED_CHATS.some((wc) => chatName.toLowerCase().includes(wc.toLowerCase()))) {
				log.info(`[debug_senders] chat="${chatName}", participant="${message.key?.participant}", pushName="${pushName}", alt="${message.verifiedName || ''}"`);
			}

			const isDirectMessage = !isGroup;
			await maybeSendAwayReply(isDirectMessage, senderJid, messageText);
			await onMessage(chatName, messageText, senderJid, pushName);
		}
	});

	// Periodic priority contacts resolution every 6 hours
	setInterval(resolvePriorityContacts, 6 * 3600 * 1000);

	return sock;
}

async function sendMessage(jid, text) {
	if (!socket) {
		throw new Error('WhatsApp is not connected. Call connectWhatsApp first.');
	}
	return socket.sendMessage(jid, { text: String(text) });
}

function toWhatsAppJid(phoneNumber) {
	const digits = String(phoneNumber ?? '').replace(/\D/g, '').replace(/^0+/, '');
	if (!digits) {
		throw new Error('toWhatsAppJid requires a phone number.');
	}
	return `${digits}@s.whatsapp.net`;
}

function isPrioritySender(senderJidOrNumber, pushName = '') {
	const digits = String(senderJidOrNumber ?? '').replace(/\D/g, '');
	if (digits.length >= 9 && priorityDigitsSet.has(digits.slice(-9))) {
		return true;
	}
	if (pushName && PRIORITY_SENDERS.some((ps) => pushName.toLowerCase().includes(ps.toLowerCase()))) {
		return true;
	}
	return false;
}

module.exports = {
	connectWhatsApp,
	sendMessage,
	toWhatsAppJid,
	isPrioritySender,
	_isDuplicateMessage: isDuplicateMessage
};
