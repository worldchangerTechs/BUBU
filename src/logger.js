const fs = require('node:fs');
const path = require('node:path');
const pino = require('pino');

const LOG_DIR = path.join(__dirname, '..', 'logs');
const LOG_FILE = path.join(LOG_DIR, 'bubu.log');
const MAX_SIZE = 2 * 1024 * 1024; // 2 MB rotation threshold

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

function ensureLogDir() {
	try {
		if (!fs.existsSync(LOG_DIR)) {
			fs.mkdirSync(LOG_DIR, { recursive: true });
		}
	} catch {
		// best-effort; logging must never throw
	}
}

function rotateIfNeeded() {
	try {
		if (!fs.existsSync(LOG_FILE)) {
			return;
		}
		const stats = fs.statSync(LOG_FILE);
		if (stats.size > MAX_SIZE) {
			// rotate: bubu.log -> bubu.log.1 (overwrite)
			const rotated = LOG_FILE + '.1';
			try {
				fs.copyFileSync(LOG_FILE, rotated);
			} catch {
				// ignore copy failure
			}
			// truncate the current log
			fs.writeFileSync(LOG_FILE, '', 'utf8');
		}
	} catch {
		// best-effort
	}
}

function format(level, message, meta) {
	const timestamp = new Date().toISOString();
	const metaStr = meta && typeof meta === 'object' && Object.keys(meta).length
		? ' ' + JSON.stringify(meta)
		: '';
	return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}`;
}

function writeLog(level, message, meta) {
	ensureLogDir();
	rotateIfNeeded();
	const line = format(level, message, meta) + '\n';
	try {
		fs.appendFileSync(LOG_FILE, line, 'utf8');
	} catch {
		// ignore file write failure
	}

	// Once the HUD is active, never write to stdout or stderr.
	const hud = getTerminalHud();
	const active = typeof hud?.isActive === 'function' ? hud.isActive() : hud?.isHudActive?.();
	if (active) {
		return;
	}

	const consoleFn = level === 'error' || level === 'warn' ? console[level] : console.log;
	try {
		consoleFn(line);
	} catch {
		// ignore
	}
}

const log = {
	info(message, meta) {
		writeLog('info', message, meta);
	},
	warn(message, meta) {
		writeLog('warn', message, meta);
	},
	error(message, meta) {
		writeLog('error', message, meta);
	},
	debug(message, meta) {
		writeLog('debug', message, meta);
	}
};

// Silent pino-compatible logger for Baileys. Baileys expects a pino instance;
// this one writes nothing anywhere so WhatsApp noise never reaches stdout.
const pinoLogger = pino({
	level: process.env.BAILEYS_LOG_LEVEL || 'silent'
});
const silentLogger = Object.create(pinoLogger);
silentLogger.info = () => {};
silentLogger.warn = () => {};
silentLogger.error = () => {};
silentLogger.fatal = () => {};
silentLogger.debug = () => {};
silentLogger.trace = () => {};
silentLogger.child = () => silentLogger;

module.exports = { log, silentLogger };