const fs = require('node:fs');
const path = require('node:path');
const { log } = require('../logger');
const store = require('../store');

const COMMANDS_DIR = __dirname;
const commands = new Map();

function normalizePunctuation(text) {
	return String(text ?? '')
		.toLowerCase()
		.replace(/[’']/g, '')
		.replace(/[.,!?;:"]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

function stripFillers(text) {
	return normalizePunctuation(text)
		.replace(/\b(please|bubu|hey|sir)\b/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

function editDistance(a, b) {
	if (a === b) return 0;
	const dp = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
	for (let i = 0; i <= a.length; i++) dp[i][0] = i;
	for (let j = 0; j <= b.length; j++) dp[0][j] = j;
	for (let i = 1; i <= a.length; i++) {
		for (let j = 1; j <= b.length; j++) {
			dp[i][j] = a[i - 1] === b[j - 1]
				? dp[i - 1][j - 1]
				: 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
		}
	}
	return dp[a.length][b.length];
}

function wordsFuzzyEqual(w1, w2) {
	if (w1 === w2) return true;
	if (w1.length >= 4 && w2.length >= 4 && editDistance(w1, w2) <= 1) return true;
	return false;
}

function fuzzyMatchTokens(inputTokens, exampleTokens) {
	if (inputTokens.length === 0 || exampleTokens.length === 0) return false;
	const input4 = inputTokens.filter((w) => w.length >= 4);
	const example4 = exampleTokens.filter((w) => w.length >= 4);

	if (example4.length === 0) {
		return inputTokens.join(' ') === exampleTokens.join(' ');
	}

	let matched = 0;
	for (const ew of example4) {
		for (const iw of input4) {
			if (wordsFuzzyEqual(ew, iw)) {
				matched += 1;
				break;
			}
		}
	}

	// Match if all significant words matched, or at least 2 significant words matched
	return matched >= Math.min(2, example4.length);
}

function fuzzyMatchExample(inputStr, exampleStr) {
	const inTokens = stripFillers(inputStr).split(/\s+/).filter(Boolean);
	const exTokens = stripFillers(exampleStr).split(/\s+/).filter(Boolean);
	return fuzzyMatchTokens(inTokens, exTokens);
}

function loadCommands() {
	if (!fs.existsSync(COMMANDS_DIR)) return;
	const files = fs.readdirSync(COMMANDS_DIR).filter((f) => f.endsWith('.js') && f !== 'registry.js');
	for (const file of files) {
		try {
			const cmd = require(path.join(COMMANDS_DIR, file));
			if (!cmd || !cmd.id || typeof cmd.match !== 'function' || typeof cmd.run !== 'function') {
				log.warn(`[registry] Skipping ${file}: missing id, match, or run`);
				continue;
			}
			if (commands.has(cmd.id)) {
				log.warn(`[registry] Duplicate command id: ${cmd.id} (from ${file})`);
				continue;
			}
			commands.set(cmd.id, cmd);
		} catch (err) {
			log.error(`[registry] Failed to load ${file}: ${err.message}`);
		}
	}

	// Map CHAT to ASK_AI if present
	if (commands.has('ASK_AI') && !commands.has('CHAT')) {
		commands.set('CHAT', commands.get('ASK_AI'));
	}
}

function getCommand(id) {
	if (commands.size === 0) loadCommands();
	return commands.get(id) || (id === 'CHAT' ? commands.get('ASK_AI') : undefined);
}

function getAllCommands() {
	if (commands.size === 0) loadCommands();
	// Return unique command objects (avoid duplicating ASK_AI / CHAT)
	const unique = new Map();
	for (const [id, cmd] of commands.entries()) {
		if (id !== 'CHAT') unique.set(cmd.id, cmd);
	}
	return Array.from(unique.values());
}

function matchWithoutAliases(rawText) {
	const rawNorm = normalizePunctuation(rawText);
	const stripped = stripFillers(rawText);

	// (1) Exact/regex match
	for (const cmd of getAllCommands()) {
		try {
			let params = cmd.match(rawNorm);
			if (params !== null && typeof params === 'object') {
				return { command: cmd.id, params };
			}
			params = cmd.match(stripped);
			if (params !== null && typeof params === 'object') {
				return { command: cmd.id, params };
			}
		} catch {}
	}

	// (2) Fuzzy match on examples
	for (const cmd of getAllCommands()) {
		if (!Array.isArray(cmd.examples)) continue;
		for (const example of cmd.examples) {
			if (fuzzyMatchExample(rawText, example)) {
				return { command: cmd.id, params: {} };
			}
		}
	}

	return null;
}

function matchCommand(rawText, customAliases) {
	if (commands.size === 0) loadCommands();
	const text = String(rawText ?? '').trim();
	if (!text) {
		return { command: 'CHAT', params: { text: '' } };
	}

	// 1 & 2: Exact/regex & Fuzzy
	const directMatch = matchWithoutAliases(text);
	if (directMatch) return directMatch;

	// 3: Learned aliases
	const aliases = customAliases || (store.getAliases ? store.getAliases() : {});
	const rawNorm = normalizePunctuation(text);
	const stripped = stripFillers(text);

	for (const [alias, target] of Object.entries(aliases)) {
		const aliasNorm = normalizePunctuation(alias);
		const aliasStripped = stripFillers(alias);
		if (aliasNorm === rawNorm || aliasStripped === stripped) {
			if (commands.has(target)) {
				return { command: target, params: {} };
			}
			const resolved = matchWithoutAliases(target);
			if (resolved) return resolved;
			return { command: target, params: {} };
		}
	}

	// 4: Anything unmatched goes to CHAT (the LLM)
	return { command: 'CHAT', params: { text } };
}

// Initial load
loadCommands();

module.exports = {
	loadCommands,
	getCommand,
	getAllCommands,
	matchCommand,
	normalize: normalizePunctuation,
	stripFillers,
	editDistance,
	wordsFuzzyEqual
};