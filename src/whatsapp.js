const fs = require('node:fs');
const path = require('node:path');
const {
	default: makeWASocket,
	useMultiFileAuthState,
	DisconnectReason
} = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const logger = require('./logger');
const { AWAY_AUTO_REPLY_TEXT } = require('./config');
const store = require('./store');
const { handleMessage } = require('./messageHandler');

const AUTH_DIR = path.join(__dirname, '..', 'auth_info');
let socket;
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

async function maybeSendAwayReply(isDirectMessage, senderJid) {
	if (!isDirectMessage || !senderJid || !store.isAwayMode() || autoRepliedSenders.has(senderJid)) {
		return;
	}

	try {
		await sendMessage(senderJid, AWAY_AUTO_REPLY_TEXT);
		autoRepliedSenders.add(senderJid);
	} catch (error) {
		logger.error(`[whatsapp] Away reply failed: ${error.message}`);
	}
}

async function connectWhatsApp(onMessage, onConnected) {
	if (typeof onMessage !== 'function') {
		throw new TypeError('connectWhatsApp requires an onMessage callback.');
	}

	fs.mkdirSync(AUTH_DIR, { recursive: true });
	const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
	const currentSocket = makeWASocket({ auth: state });
	socket = currentSocket;

	currentSocket.ev.on('creds.update', saveCreds);
	currentSocket.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
		if (qr) {
			qrcode.generate(qr, { small: true });
		}

		if (connection === 'open') {
			logger.info('[whatsapp] Connected!');
			onConnected?.();
		}

		if (connection === 'close') {
			const statusCode = lastDisconnect?.error?.output?.statusCode
				?? lastDisconnect?.error?.statusCode;
			if (statusCode !== DisconnectReason.loggedOut) {
				connectWhatsApp(onMessage).catch((error) => {
					logger.error(`[whatsapp] Reconnect failed: ${error.message}`);
				});
			}
		}
	});

	currentSocket.ev.on('messages.upsert', async ({ messages, type }) => {
		if (type !== 'notify') {
			return;
		}

		for (const message of messages) {
			if (message.key.fromMe || message.key.remoteJid === 'status@broadcast') {
				continue;
			}

			const chatName = await getChatName(currentSocket, message);
			const messageText = getMessageText(message.message);
			const senderJid = message.key.participant || message.key.remoteJid;
			const isDirectMessage = !message.key.remoteJid?.endsWith('@g.us');
			await maybeSendAwayReply(isDirectMessage, senderJid);
			await onMessage(chatName, messageText, senderJid);
		}
	});

	return currentSocket;
}

async function sendMessage(jid, text) {
	if (!socket) {
		throw new Error('WhatsApp is not connected. Call connectWhatsApp first.');
	}

	return socket.sendMessage(jid, { text: String(text) });
}

module.exports = { connectWhatsApp, sendMessage };
