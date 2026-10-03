#!/usr/bin/env node
// Supervisor for BUBU startup. This function is intentionally separate from WhatsApp
// so the local app can start listening before the network connection is available.
const { spawn, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');

const PROJECT_DIR = path.join(__dirname, '..');
const PID_FILE = path.join(PROJECT_DIR, '.bubu-up.pids');
const LLM_LOG = path.join(PROJECT_DIR, 'bubu-llm.log');
const PORT = Number(process.env.LLM_PORT || '8090');
const MODEL = process.env.BUBU_LLM_MODEL || process.env.LLM_MODEL || '';
const SKIP_LLM = process.env.SKIP_LLM === '1';

function findLlamaBin() {
	if (process.env.LLAMA_BIN) return process.env.LLAMA_BIN;
	for (const candidate of ['llama-server', 'server']) {
		const found = spawnSync('command', ['-v', candidate], { shell: true });
		if (found.status === 0) return candidate;
	}
	return null;
}

function waitForLlmHealth(port, timeoutMs) {
	const deadline = Date.now() + timeoutMs;
	return new Promise((resolve) => {
		const poll = () => {
			const req = http.get({ host: '127.0.0.1', port, path: '/health', timeout: 3000 }, (res) => {
				res.resume();
				if (res.statusCode && res.statusCode < 500) return resolve(true);
				if (Date.now() > deadline) return resolve(false);
				setTimeout(poll, 2000);
			});
			req.on('error', () => {
				if (Date.now() > deadline) return resolve(false);
				setTimeout(poll, 2000);
			});
			req.on('timeout', () => req.destroy());
		};
		poll();
	});
}

async function main() {
	const children = [];
	const stop = (signal) => {
		for (const child of children) {
			try { child.kill(signal); } catch {}
		}
	};
	process.on('SIGINT', () => stop('SIGINT'));
	process.on('SIGTERM', () => stop('SIGTERM'));

	let llm = null;
	if (SKIP_LLM) {
		console.log('[bubu-up] SKIP_LLM=1 — starting the bot only.');
	} else if (!MODEL) {
		console.log('[bubu-up] No model set; starting bot without local LLM.');
	} else if (!fs.existsSync(MODEL.replace(/^~/, os.homedir()))) {
		console.log(`[bubu-up] Model not found: ${MODEL} — starting bot without local LLM.`);
	} else {
		const bin = findLlamaBin();
		if (!bin) {
			console.log('[bubu-up] llama-server binary not found — continuing in local-offline mode.');
		} else {
			const modelPath = MODEL.replace(/^~/, os.homedir());
			const extra = (process.env.LLM_EXTRA_ARGS || '').split(' ').filter(Boolean);
			const args = ['--model', modelPath, '--host', '127.0.0.1', '--port', String(PORT), ...extra];
			console.log(`[bubu-up] Starting LLM: ${bin} ${args.join(' ')}`);
			const logStream = fs.createWriteStream(LLM_LOG, { flags: 'a' });
			llm = spawn(bin, args, { cwd: PROJECT_DIR, stdio: ['ignore', logStream, logStream] });
			children.push(llm);
			llm.on('exit', (code) => console.log(`[bubu-up] LLM server exited (code ${code}). See ${LLM_LOG}`));
			console.log('[bubu-up] Waiting for LLM health check...');
			const ready = await waitForLlmHealth(PORT, 120000);
			console.log(ready ? '[bubu-up] LLM is up.' : '[bubu-up] LLM not responding yet — continuing anyway.');
		}
	}

	console.log('[bubu-up] Starting BUBU runtime...');
	const bot = spawn(process.execPath, [path.join(PROJECT_DIR, 'src', 'index.js')], {
		cwd: PROJECT_DIR,
		stdio: process.env.BUBU_TEXT === '1' ? 'inherit' : ['ignore', 'inherit', 'inherit'],
		env: {
			...process.env,
			LLM_PORT: String(PORT),
			...(process.env.BUBU_TEXT === '1' ? {} : { BUBU_TEXT: '0' })
		}
	});
	children.push(bot);

	try {
		fs.writeFileSync(PID_FILE, JSON.stringify({
			llm: llm?.pid || null,
			bot: bot.pid || null,
			startedAt: new Date().toISOString()
		}) + '\n', 'utf8');
	} catch {}

	bot.on('exit', (code) => {
		console.log(`[bubu-up] BUBU exited (code ${code}). Stopping LLM.`);
		stop('SIGTERM');
		try { fs.unlinkSync(PID_FILE); } catch {}
		process.exitCode = code ?? 1;
	});
}

main().catch((error) => {
	console.error(`[bubu-up] Startup failed: ${error.message}`);
	process.exit(1);
});
