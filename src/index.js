require('dotenv').config();

const { connectWhatsApp } = require('./whatsapp');
const { handleMessage } = require('./messageHandler');
const { handleTextCommand } = require('./voiceRouter');
const readline = require('node:readline');
const logger = require('./logger');
const { OWNER_PHONE_NUMBER, AWAY_REPLY_MODE } = require('./config');
const store = require('./store');
const { startSmsWatcher } = require('./smsWatcher');
const { sendSms } = require('./termux/sms');
const { complete } = require('./llmClient');
const { AWAY_REPLY_SYSTEM_PROMPT } = require('./personality');

const autoRepliedSmsSenders = new Set();

function startHudWhenConnected() {
	try {
		const hud = require('./hud/terminalHud');
		hud.startHud();
		hud.setStatus('BUBU ONLINE');
	} catch (error) {
		console.warn(`[bubu] HUD unavailable: ${error.message}`);
	}
}

async function handleNewSms(from, body) {
	logger.info(`[sms] New message from ${from || 'unknown sender'}`);
	if (!store.isAwayMode() || AWAY_REPLY_MODE !== 'AI') {
		return;
	}
	if (!from || autoRepliedSmsSenders.has(from)) {
		return;
	}

	let replyText;
	try {
		replyText = await complete(body || '', AWAY_REPLY_SYSTEM_PROMPT);
	} catch (error) {
		logger.warn(`[sms] AI away reply unavailable: ${error.message}`);
		return;
	}

	try {
		await sendSms(from, replyText);
		autoRepliedSmsSenders.add(from);
	} catch (error) {
		logger.error(`[sms] Away reply failed: ${error.message}`);
	}
}

async function start() {
	logger.info('[bubu] Starting WhatsApp assistant...');
	startSmsWatcher(handleNewSms);
	await connectWhatsApp(handleMessage, startHudWhenConnected, OWNER_PHONE_NUMBER);
	// Text trigger: type any BUBU command into this same terminal while the bot runs
	// (same command set as voice, e.g. "read my messages", "text mum saying ...").
	// Disabled automatically when stdin is not a TTY (e.g. under bubu-up.js).
	if (process.stdin.isTTY && process.env.BUBU_TEXT !== '0') {
		const rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: 'bubu> ' });
		rl.prompt();
		rl.on('line', async (line) => {
			const text = line.trim();
			if (text) {
				try {
					await handleTextCommand(text);
				} catch (error) {
					logger.error(`[bubu] Text command failed: ${error.message}`);
				}
			}
			rl.prompt();
		});
	}
}

(async () => {
	try {
		await start();
	} catch (error) {
		logger.error(`[bubu] Startup failed: ${error.message}`);
		process.exit(1);
	}
})();
