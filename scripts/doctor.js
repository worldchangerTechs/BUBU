#!/usr/bin/env node
const { execFile, spawn, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const PROJECT_DIR = path.join(__dirname, '..');
const PACKAGE_JSON = path.join(PROJECT_DIR, 'package.json');

function resolveBinaryOnPath(cmd) {
	const executable = process.platform === 'win32' ? 'where' : 'which';
	const result = spawnSync(executable, [cmd], { shell: false, encoding: 'utf8' });
	if (result.status === 0) {
		const output = String(result.stdout || '').trim();
		const first = output.split(/\r?\n/).find(Boolean);
		return first || output;
	}
	return '';
}

const CHECKS = [
	{ id: 'node', name: 'Node.js >= 18', fn: checkNode },
	{ id: 'termux-tts-speak', name: 'termux-tts-speak', fn: () => checkTermuxBinary('termux-tts-speak') },
	{ id: 'termux-speech-to-text', name: 'termux-speech-to-text', fn: () => checkTermuxBinary('termux-speech-to-text') },
	{ id: 'termux-sms-list', name: 'termux-sms-list', fn: () => checkTermuxBinary('termux-sms-list') },
	{ id: 'termux-call-log', name: 'termux-call-log', fn: () => checkTermuxBinary('termux-call-log') },
	{ id: 'termux-contact-list', name: 'termux-contact-list', fn: () => checkTermuxBinary('termux-contact-list') },
	{ id: 'termux-microphone-record', name: 'termux-microphone-record', fn: () => checkTermuxBinary('termux-microphone-record') },
	{ id: 'termux-media-player', name: 'termux-media-player', fn: () => checkTermuxBinary('termux-media-player') },
	{ id: 'termux-open-url', name: 'termux-open-url', fn: () => checkTermuxBinary('termux-open-url') },
	{ id: 'termux-wake-lock', name: 'termux-wake-lock', fn: () => checkTermuxBinary('termux-wake-lock') },
	{ id: 'curl', name: 'curl', fn: () => checkBinary('curl') },
	{ id: 'dotenv-count', name: '.env loaded variable count', fn: checkDotenvCount },
	{ id: 'model-file', name: 'Model file exists & >100MB', fn: checkModelFile },
	{ id: 'llama-server-bin', name: 'llama-server executable', fn: checkLlamaServerBin },
	{ id: 'llama-health', name: 'llama-server /health', fn: checkLlamaHealth },
	{ id: 'points-json', name: 'hud/points.json present', fn: checkPointsJson },
	{ id: 'baileys-version', name: '@whiskeysockets/baileys not prerelease', fn: checkBaileysVersion },
	{ id: 'voice-command', name: 'voice-command.sh folder exists', fn: checkVoiceCommand },
	{ id: 'disk-space', name: 'Free disk >500 MB', fn: checkDiskSpace }
];

async function runCheck(check) {
	const start = Date.now();
	let result;
	try {
		result = await check.fn();
	} catch (err) {
		result = { status: 'FAIL', message: err.message };
	}
	const duration = Date.now() - start;
	const icon = result.status === 'PASS' ? '✓' : result.status === 'WARN' ? '⚠' : '✗';
	console.log(`${icon} ${check.name.padEnd(40)} [${result.status}] ${result.message || ''} (${duration}ms)`);
	return { ...result, name: check.name };
}

function checkNode() {
	const version = process.version;
	const major = parseInt(version.slice(1).split('.')[0], 10);
	if (major >= 18) {
		return { status: 'PASS', message: `v${major}` };
	}
	return { status: 'FAIL', message: `Node ${version} < 18` };
}

function checkBinary(cmd) {
	const result = resolveBinaryOnPath(cmd);
	if (result) {
		return { status: 'PASS', message: result };
	}
	return { status: 'WARN', message: 'not found (permission or missing)' };
}

function checkTermuxBinary(cmd) {
	const result = resolveBinaryOnPath(cmd);
	if (result) {
		return { status: 'PASS', message: result };
	}
	return { status: 'WARN', message: 'not found (permission or missing)' };
}

function checkDotenvCount() {
	require('dotenv').config();
	let count = 0;
	for (const key of Object.keys(process.env)) {
		if (key.startsWith('BUBU_') || key.startsWith('LLAMA_') || key.startsWith('ELEVENLABS_') || key.startsWith('ANTHROPIC_') || key.startsWith('PRIORITY_') || key.startsWith('DEBUG_') || key.startsWith('WAKE_') || key.startsWith('NO_HUD')) {
			count += 1;
		}
	}
	if (count === 0) {
		return { status: 'WARN', message: '0 variables loaded' };
	}
	return { status: 'PASS', message: `${count} variables loaded` };
}

function checkModelFile() {
	require('dotenv').config();
	const modelPath = (process.env.LLAMA_MODEL_PATH || process.env.BUBU_LLM_MODEL || '').replace(/^~/, os.homedir());
	if (!modelPath) {
		return { status: 'FAIL', message: 'LLAMA_MODEL_PATH not set' };
	}
	if (!fs.existsSync(modelPath)) {
		return { status: 'FAIL', message: `not found: ${modelPath}` };
	}
	const stats = fs.statSync(modelPath);
	const sizeMB = Math.round(stats.size / 1024 / 1024);
	if (sizeMB < 100) {
		return { status: 'FAIL', message: `${sizeMB}MB (must be over 100MB)` };
	}
	return { status: 'PASS', message: `${sizeMB}MB` };
}

function checkLlamaServerBin() {
	require('dotenv').config();
	const bin = process.env.LLAMA_SERVER_BIN || 'llama-server';
	if (bin.includes('/') || bin.includes('\\')) {
		const abs = bin.replace(/^~/, os.homedir());
		if (!fs.existsSync(abs)) {
			return { status: 'FAIL', message: `not found: ${bin}` };
		}
		try {
			fs.accessSync(abs, fs.constants.X_OK);
			return { status: 'PASS', message: bin };
		} catch {
			return { status: 'FAIL', message: `not executable: ${bin}` };
		}
	}
	// bare binary: check via command -v
	const result = resolveBinaryOnPath(bin);
	if (result) {
		return { status: 'PASS', message: result };
	}
	return { status: 'WARN', message: 'not on PATH' };
}

function checkLlamaHealth() {
	require('dotenv').config();
	const port = process.env.LLM_PORT || '8090';
	const url = `http://127.0.0.1:${port}/health`;
	return new Promise((resolve) => {
		const req = require('node:http').get(url, { timeout: 3000 }, (res) => {
			res.resume();
			if (res.statusCode && res.statusCode < 500) {
				resolve({ status: 'PASS', message: `HTTP ${res.statusCode}` });
			} else {
				resolve({ status: 'WARN', message: `HTTP ${res.statusCode || 'error'}` });
			}
		});
		req.on('error', () => resolve({ status: 'WARN', message: 'not reachable' }));
		req.on('timeout', () => { req.destroy(); resolve({ status: 'WARN', message: 'timeout' }); });
	});
}

function checkPointsJson() {
	const pts = path.join(PROJECT_DIR, 'src', 'hud', 'points.json');
	if (fs.existsSync(pts)) {
		return { status: 'PASS', message: 'present' };
	}
	return { status: 'FAIL', message: 'missing' };
}

function checkBaileysVersion() {
	try {
		const pkg = JSON.parse(fs.readFileSync(PACKAGE_JSON, 'utf8'));
		const version = pkg.dependencies?.['@whiskeysockets/baileys'] || '';
		if (version) {
			const isPrerelease = /(rc|alpha|beta)/i.test(version);
			if (isPrerelease) {
				return { status: 'WARN', message: `pinned to prerelease ${version}` };
			}
			return { status: 'PASS', message: version };
		}
		return { status: 'WARN', message: 'not in dependencies' };
	} catch {
		return { status: 'FAIL', message: 'package.json unreadable' };
	}
}

function checkVoiceCommand() {
	const script = path.join(PROJECT_DIR, 'voice-command.sh');
	if (!fs.existsSync(script)) {
		return { status: 'FAIL', message: 'voice-command.sh missing' };
	}
	const content = fs.readFileSync(script, 'utf8');
	const match = content.match(/PROJECT_DIR=["']?([^"'\s]+)["']?/);
	if (!match) {
		return { status: 'WARN', message: 'PROJECT_DIR not found in script' };
	}
	const dir = match[1].replace('$HOME', os.homedir()).replace('${HOME}', os.homedir()).replace('~', os.homedir());
	if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
		return { status: 'PASS', message: dir };
	}
	return { status: 'FAIL', message: `folder not found: ${dir}` };
}

function checkDiskSpace() {
	try {
		if (typeof fs.statfsSync === 'function') {
			const stats = fs.statfsSync('.');
			const freeMB = Math.floor((stats.bavail * stats.bsize) / 1024 / 1024);
			if (freeMB >= 500) {
				return { status: 'PASS', message: `${freeMB}MB free` };
			}
			return { status: 'FAIL', message: `${freeMB}MB free (<500MB)` };
		}
	} catch {}

	try {
		const { stdout } = require('node:child_process').execSync('df -k .', { encoding: 'utf8', timeout: 5000 });
		const lines = stdout.trim().split('\n');
		if (lines.length >= 2) {
			const parts = lines[1].split(/\s+/);
			const freeKB = parseInt(parts[3], 10);
			const freeMB = Math.floor(freeKB / 1024);
			if (freeMB >= 500) {
				return { status: 'PASS', message: `${freeMB}MB free` };
			}
			return { status: 'FAIL', message: `${freeMB}MB free (<500MB)` };
		}
	} catch {
		// df not available on Windows; best-effort
	}
	return { status: 'WARN', message: 'could not determine' };
}

async function main() {
	console.log('BUBU Doctor');
	console.log('===========');
	const results = [];
	for (const check of CHECKS) {
		const result = await runCheck(check);
		results.push(result);
	}
	const fails = results.filter((r) => r.status === 'FAIL');
	const warns = results.filter((r) => r.status === 'WARN');
	const passes = results.filter((r) => r.status === 'PASS');
	console.log('-----------');
	console.log(`Summary: ${passes.length} PASS, ${warns.length} WARN, ${fails.length} FAIL`);
	if (fails.length > 0) {
		process.exitCode = 1;
	}
}

main().catch((err) => {
	console.error('Doctor crashed:', err.message);
	process.exit(1);
});