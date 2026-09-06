let terminalHud;

function getTerminalHud() {
	if (terminalHud !== undefined) {
		return terminalHud;
	}

	try {
		terminalHud = require('./hud/terminalHud');
	} catch {
		terminalHud = null;
	}

	return terminalHud;
}

function write(level, message) {
	const timestamp = new Date().toISOString();
	const output = `[${timestamp}] ${message}`;
	const hud = getTerminalHud();
	if (hud?.isHudActive()) {
		hud.setStatus(output);
		return;
	}

	console[level](output);
}

module.exports = {
	info(message) {
		write('log', message);
	},
	warn(message) {
		write('warn', message);
	},
	error(message) {
		write('error', message);
	}
};
