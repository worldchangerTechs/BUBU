const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { connectWhatsApp } = require('./whatsapp');
const { handleMessage } = require('./messageHandler');
const { handleTextCommand, startListeningLoop } = require('./voiceRouter');
const readline = require('node:readline');
const { log } = require('./logger');
const { OWNER_PHONE_NUMBER, AWAY_REPLY_MODE } = require('./config');
const store = require('./store');
const { startSmsWatcher } = require('./smsWatcher');
const { sendSms } = require('./termux/sms');
const { complete } = require('./llmClient');
const { AWAY_REPLY_SYSTEM_PROMPT } = require('./personality');
const { say } = require('./audio');
const { setBubuStatus } = require('./store');

const autoRepliedSmsSenders = new Set();

function getTimeGreeting() {
	const hour = new Date().getHours();
	if (hour >= 5 && hour <= 11) return 'Good morning, Mr. Tipape, sir.';
	if (hour >= 12 && hour <= 16) return 'Good afternoon, Mr. Tipape, sir.';
	if (hour >= 17 && hour <= 20) return 'Good evening, Mr. Tipape, sir.';
	return "You're up late, sir — burning the midnight oil?";
}

async function bootSequence() {
	setBubuStatus({
		core: 'ONLINE',
		llm: process.env.ANTHROPIC_API_KEY ? 'CLOUD' : 'LOCAL',
		whatsapp: 'CONNECTING'
	});

	if (typeof startListeningLoop === 'function') {
		startListeningLoop();
	}

	await say(getTimeGreeting());
	await say('What would you like me to start with, sir?');
	return true;
}

function startHudWhenConnected() {
	try {
		const hud = require('./hud/terminalHud');
		hud.startHud();
		hud.setStatus('LISTENING');
		startListeningLoop();
	} catch (error) {
		log.warn(`[bubu] HUD unavailable: ${error.message}`);
	}
}

async function handleNewSms(from, body) {
	log.info(`[sms] New message from ${from || 'unknown sender'}`);
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
		log.warn(`[sms] AI away reply unavailable: ${error.message}`);
		return;
	}

	try {
		await sendSms(from, replyText);
		autoRepliedSmsSenders.add(from);
	} catch (error) {
		log.error(`[sms] Away reply failed: ${error.message}`);
	}
}

async function start() {
	log.info('[bubu] Starting WhatsApp assistant...');
	startSmsWatcher(handleNewSms);
	const bootPromise = bootSequence();
	void connectWhatsApp(handleMessage, startHudWhenConnected, OWNER_PHONE_NUMBER);
	await bootPromise;
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
					log.error(`[bubu] Text command failed: ${error.message}`);
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
		log.error(`[bubu] Startup failed: ${error.message}`);
		process.exit(1);
	}
})();

module.exports = { bootSequence };
