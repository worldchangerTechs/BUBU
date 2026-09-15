#!/usr/bin/env node
// BUBU UP — starts everything with one command:
//   1. Local LLM server (llama-server on 127.0.0.1:8090, used by src/llmClient.js)
//   2. WhatsApp bot (src/index.js, which auto-starts the HUD on connect)
//   3. Command triggers (both live together):
//        - VOICE: "bubu voice" in a second Termux session (Termux:API mic)
//        - TEXT:  "npm run bubu <command>" or BUBU_TEXT=1 interactive prompt
// Usage:
//   npm run up
//   BUBU_LLM_MODEL=~/models/bubu.gguf npm run up
//   LLM_PORT=8090 LLAMA_BIN=llama-server npm run up
// Env:
//   BUBU_LLM_MODEL / LLM_MODEL  path to .gguf model file (optional but needed for AI replies)
//   LLM_PORT                    default 8090 (must match src/llmClient.js)
//   LLAMA_BIN                   default: auto-detect "llama-server", then "server"
//   LLM_EXTRA_ARGS              extra args appended to llama-server, e.g. "--ctx-size 2048 --threads 4"
//   SKIP_LLM=1                  start only the WhatsApp bot (AI falls back to STATIC replies)
//   BUBU_TEXT=1                 also steal stdin for an interactive "bubu>" prompt
//                               (default off: stdin stays free so "npm run bubu" works per command)
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
			try { child.kill(signal); } catch { /* already exited */ }
		}
	};
	process.on('SIGINT', () => { stop('SIGINT'); });
	process.on('SIGTERM', () => { stop('SIGTERM'); });

	// 1. Local LLM server (llama.cpp OpenAI-compat + legacy /completion API).
	let llm = null;
	if (SKIP_LLM) {
		console.log('[bubu-up] SKIP_LLM=1 — starting WhatsApp bot only (AI replies will fall back).');
	} else if (!MODEL) {
		console.log('[bubu-up] No model set (BUBU_LLM_MODEL is empty) — starting WhatsApp bot only.');
		console.log('[bubu-up] To enable AI replies: BUBU_LLM_MODEL=~/models/your-model.gguf npm run up');
	} else if (!fs.existsSync(MODEL.replace(/^~/, os.homedir()))) {
		console.log(`[bubu-up] Model not found: ${MODEL} — starting WhatsApp bot only.`);
	} else {
		const bin = findLlamaBin();
		if (!bin) {
			console.log('[bubu-up] llama-server binary not found — starting WhatsApp bot only.');
			console.log('[bubu-up] Install llama.cpp (pkg install llama.cpp) or set LLAMA_BIN=/path/to/llama-server');
		} else {
			const modelPath = MODEL.replace(/^~/, os.homedir());
			const extra = (process.env.LLM_EXTRA_ARGS || '').split(' ').filter(Boolean);
			const args = ['--model', modelPath, '--host', '127.0.0.1', '--port', String(PORT), ...extra];
			console.log(`[bubu-up] Starting LLM: ${bin} ${args.join(' ')}`);
			const logStream = fs.createWriteStream(LLM_LOG, { flags: 'a' });
			llm = spawn(bin, args, { cwd: PROJECT_DIR, stdio: ['ignore', logStream, logStream] });
			children.push(llm);
			llm.on('exit', (code) => console.log(`[bubu-up] LLM server exited (code ${code}). See bubu-llm.log`));
			console.log('[bubu-up] Waiting for LLM on 127.0.0.1:8090 (/health, up to 120s)...');
			const ready = await waitForLlmHealth(PORT, 120000);
			console.log(ready
				? '[bubu-up] LLM is up.'
				: '[bubu-up] LLM not responding yet — continuing anyway; bot will retry per request.');
		}
	}

	// 2. WhatsApp bot (auto-starts the terminal HUD once connected).
	// NOTE: stdin is NOT inherited here on purpose — it stays free so
	// `npm run bubu <command>` (text trigger) works while the bot runs.
	// Set BUBU_TEXT=1 if you instead want an interactive "bubu>" prompt
	// inside the `npm run up` terminal (voice then still works via `npm run voice`).
	console.log('[bubu-up] Starting WhatsApp bot (HUD starts automatically on connect)...');
	console.log('[bubu-up] Triggers: VOICE -> run "npm run voice" in another session | TEXT -> run "npm run bubu <command>"');
	const interactiveText = process.env.BUBU_TEXT === '1';
	const bot = spawn(process.execPath, [path.join(PROJECT_DIR, 'src', 'index.js')], {
		cwd: PROJECT_DIR,
		stdio: interactiveText ? 'inherit' : ['ignore', 'inherit', 'inherit'],
		env: {
			...process.env,
			LLM_PORT: String(PORT),
			...(interactiveText ? {} : { BUBU_TEXT: '0' })
		}
	});
	children.push(bot);

	try {
		fs.writeFileSync(PID_FILE, JSON.stringify({
			llm: llm?.pid || null,
			bot: bot.pid || null,
			startedAt: new Date().toISOString()
		}) + '\n', 'utf8');
	} catch { /* pid file is best-effort */ }

	bot.on('exit', (code) => {
		console.log(`[bubu-up] WhatsApp bot exited (code ${code}). Stopping LLM...`);
		stop('SIGTERM');
		try { fs.unlinkSync(PID_FILE); } catch { /* already gone */ }
		process.exitCode = code ?? 1;
	});
}

main().catch((error) => {
	console.error(`[bubu-up] Startup failed: ${error.message}`);
	process.exit(1);
});
