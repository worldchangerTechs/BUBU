const { connectWhatsApp } = require('./whatsapp');
const { handleMessage } = require('./messageHandler');

async function start() {
	console.log('[bubu] Starting WhatsApp assistant...');
	await connectWhatsApp(handleMessage);
}

(async () => {
	try {
		await start();
	} catch (error) {
		console.error(`[bubu] Startup failed: ${error.message}`);
		process.exit(1);
	}
})();
