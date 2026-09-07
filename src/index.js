require('dotenv').config();

const { connectWhatsApp } = require('./whatsapp');
const { handleMessage } = require('./messageHandler');
const logger = require('./logger');
const { OWNER_PHONE_NUMBER } = require('./config');

function startHudWhenConnected() {
	try {
		const hud = require('./hud/terminalHud');
		hud.startHud();
		hud.setStatus('BUBU ONLINE');
	} catch (error) {
		console.warn(`[bubu] HUD unavailable: ${error.message}`);
	}
}

async function start() {
	logger.info('[bubu] Starting WhatsApp assistant...');
	await connectWhatsApp(handleMessage, startHudWhenConnected, OWNER_PHONE_NUMBER);
}

(async () => {
	try {
		await start();
	} catch (error) {
		logger.error(`[bubu] Startup failed: ${error.message}`);
		process.exit(1);
	}
})();
