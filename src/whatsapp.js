const fs = require('node:fs');
const path = require('node:path');
const {
	default: makeWASocket,
	useMultiFileAuthState,
	DisconnectReason,
	Browsers,
	fetchLatestBaileysVersion
} = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const logger = require('./logger');
const { AWAY_AUTO_REPLY_TEXT, AWAY_REPLY_MODE } = require('./config');
const { AWAY_REPLY_SYSTEM_PROMPT } = require('./personality');
const { complete } = require('./llmClient');
const store = require('./store');
const { handleMessage } = require('./messageHandler');

const AUTH_DIR = path.join(__dirname, '..', 'auth_info');
let socket;
let pairingRequested = false;
let reconnectTimer = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_DELAY_MS = 60000;
const autoRepliedSenders = new Set();

function normalizePhoneNumber(phoneNumber) {
	return String(phoneNumber || '').replace(/\D/g, '');
}

function clearReconnectTimer() {
	if (reconnectTimer) {
		clearTimeout(reconnectTimer);
		reconnectTimer = null;
	}
}

function scheduleReconnect(onMessage, onConnected, phoneNumber, baseDelayMs) {
	if (reconnectTimer) {
		return;
	}
	reconnectAttempts += 1;
	const delayMs = Math.min(baseDelayMs * reconnectAttempts, MAX_RECONNECT_DELAY_MS);
	logger.info(`[whatsapp] Reconnecting in ${Math.round(delayMs / 1000)}s (attempt ${reconnectAttempts})...`);
	reconnectTimer = setTimeout(() => {
		reconnectTimer = null;
		connectWhatsApp(onMessage, onConnected, phoneNumber).catch((error) => {
			logger.error(`[whatsapp] Reconnect failed: ${error.message}`);
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

async function getChatName(currentSocket, message) {
	const remoteJid = message.key.remoteJid;
	if (remoteJid?.endsWith('@g.us')) {
		try {
			const metadata = await currentSocket.groupMetadata(remoteJid);
			return metadata.subject || remoteJid;
		} catch {
			return remoteJid;
		}
	}

	return message.pushName || remoteJid;
}

async function maybeSendAwayReply(isDirectMessage, senderJid, messageText) {
	if (!isDirectMessage || !senderJid || !store.isAwayMode() || autoRepliedSenders.has(senderJid)) {
		return;
	}

	try {
		let replyText = AWAY_AUTO_REPLY_TEXT;
		if (AWAY_REPLY_MODE === 'AI') {
			try {
				replyText = await complete(messageText, AWAY_REPLY_SYSTEM_PROMPT);
			} catch (error) {
				logger.warn(`[whatsapp] AI away reply unavailable: ${error.message}; using static reply.`);
			}
		}

		await sendMessage(senderJid, replyText);
		autoRepliedSenders.add(senderJid);
	} catch (error) {
		logger.error(`[whatsapp] Away reply failed: ${error.message}`);
	}
}

async function connectWhatsApp(onMessage, onConnected, phoneNumber) {
	if (typeof onMessage !== 'function') {
		throw new TypeError('connectWhatsApp requires an onMessage callback.');
	}

	fs.mkdirSync(AUTH_DIR, { recursive: true });
	const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
	clearReconnectTimer();
	let version;
	try {
		({ version } = await fetchLatestBaileysVersion());
	} catch (error) {
		logger.warn(`[whatsapp] Could not fetch latest WhatsApp Web version, using bundled defaults: ${error.message}`);
	}
	const sock = makeWASocket({
		auth: state,
		...(version ? { version } : {}),
		browser: Browsers.ubuntu('Chrome'),
		printQRInTerminal: false,
		syncFullHistory: false,
		markOnlineOnConnect: false
	});
	socket = sock;
	let hasOpened = false;

	sock.ev.on('creds.update', saveCreds);
	sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
		if (qr && !phoneNumber) {
			qrcode.generate(qr, { small: true });
		}

		if (connection === 'open') {
			hasOpened = true;
			reconnectAttempts = 0;
			logger.info('[whatsapp] Connected!');
			onConnected?.();
		}

		if (connection === 'close') {
			logger.error(`[whatsapp] Connection closed: ${lastDisconnect?.error?.message || lastDisconnect?.error}`);
			try {
				sock.end(undefined);
			} catch {
				// Socket is already closed; nothing to clean up.
			}
			const statusCode = lastDisconnect?.error?.output?.statusCode
				?? lastDisconnect?.error?.statusCode;
			if (statusCode === DisconnectReason.loggedOut) {
				return;
			}
			if (pairingRequested && !hasOpened) {
				logger.info('[whatsapp] Waiting for the pairing code to be entered...');
				scheduleReconnect(onMessage, onConnected, phoneNumber, 25000);
				return;
			}
			scheduleReconnect(onMessage, onConnected, phoneNumber, 5000);
		}
	});

	const normalizedPhoneNumber = normalizePhoneNumber(phoneNumber);
	if (normalizedPhoneNumber) {
		setTimeout(async () => {
			if (!pairingRequested && !sock.authState.creds.registered) {
				try {
					const pairingCodePromise = sock.requestPairingCode(normalizedPhoneNumber);
					pairingRequested = true;
					const pairingCode = await pairingCodePromise;
					console.log(`=== Link WhatsApp with this code: ${pairingCode} ===`);
				} catch (error) {
					logger.error(`[whatsapp] Pairing code request failed: ${error.message}`);
				}
			}
		}, 3000);
	}

	sock.ev.on('messages.upsert', async ({ messages, type }) => {
		if (type !== 'notify') {
			return;
		}

		for (const message of messages) {
			if (message.key.fromMe || message.key.remoteJid === 'status@broadcast') {
				continue;
			}

			const chatName = await getChatName(sock, message);
			const messageText = getMessageText(message.message);
			const senderJid = message.key.participant || message.key.remoteJid;
						const senderName = message.pushName || message.verifiedName || '';
			const isDirectMessage = !message.key.remoteJid?.endsWith('@g.us');
			await maybeSendAwayReply(isDirectMessage, senderJid, messageText);
						await onMessage(chatName, messageText, senderJid, senderName);
		}
	});

	return sock;
}

async function sendMessage(jid, text) {
	if (!socket) {
		throw new Error('WhatsApp is not connected. Call connectWhatsApp first.');
	}

	return socket.sendMessage(jid, { text: String(text) });
}

// Contact-list numbers come back in display form ("+254 712 345678",
// "0712-345-678"). Baileys needs pure country-code digits + suffix:
// "254712345678@s.whatsapp.net". Leading trunk zero is dropped because it
// is never part of the international form.
function toWhatsAppJid(phoneNumber) {
	const digits = String(phoneNumber ?? '').replace(/\D/g, '').replace(/^0+/, '');
	if (!digits) {
		throw new Error('toWhatsAppJid requires a phone number.');
	}
	return `${digits}@s.whatsapp.net`;
}

module.exports = { connectWhatsApp, sendMessage, toWhatsAppJid };
