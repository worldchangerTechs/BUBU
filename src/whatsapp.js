const fs = require('node:fs');
const path = require('node:path');
const {
	default: makeWASocket,
	useMultiFileAuthState,
	DisconnectReason
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
const autoRepliedSenders = new Set();

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
	const sock = makeWASocket({ auth: state });
	socket = sock;
	let hasOpened = false;

	sock.ev.on('creds.update', saveCreds);
	sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
		if (qr && !phoneNumber) {
			qrcode.generate(qr, { small: true });
		}

		if (connection === 'open') {
			hasOpened = true;
			logger.info('[whatsapp] Connected!');
			onConnected?.();
		}

		if (connection === 'close') {
			logger.error(`[whatsapp] Connection closed: ${lastDisconnect?.error?.message || lastDisconnect?.error}`);
			const statusCode = lastDisconnect?.error?.output?.statusCode
				?? lastDisconnect?.error?.statusCode;
			if (statusCode === DisconnectReason.loggedOut) {
				return;
			}
			if (pairingRequested && !hasOpened) {
				logger.info('[whatsapp] Waiting for the pairing code to be entered...');
				setTimeout(() => {
					connectWhatsApp(onMessage, onConnected, phoneNumber).catch((error) => {
						logger.error(`[whatsapp] Reconnect failed: ${error.message}`);
					});
				}, 25000);
				return;
			}
			connectWhatsApp(onMessage, onConnected, phoneNumber).catch((error) => {
				logger.error(`[whatsapp] Reconnect failed: ${error.message}`);
			});
		}
	});

	if (typeof phoneNumber === 'string' && phoneNumber.trim()) {
		setTimeout(async () => {
			if (!pairingRequested && !sock.authState.creds.registered) {
				try {
					const pairingCodePromise = sock.requestPairingCode(phoneNumber.trim());
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
			const isDirectMessage = !message.key.remoteJid?.endsWith('@g.us');
			await maybeSendAwayReply(isDirectMessage, senderJid, messageText);
			await onMessage(chatName, messageText, senderJid);
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

module.exports = { connectWhatsApp, sendMessage };
