const fs = require('node:fs');
const path = require('node:path');

const FRAME_INTERVAL_MS = 125;
const BRAILLE_DOTS = [
	[0, 0, 0x01], [0, 1, 0x02], [0, 2, 0x04], [1, 0, 0x08],
	[1, 1, 0x10], [1, 2, 0x20], [0, 3, 0x40], [1, 3, 0x80]
];
const CYAN = '\x1b[36m';
const DIM_CYAN = '\x1b[2;36m';
const RESET = '\x1b[0m';
const CLEAR_HOME = '\x1b[2J\x1b[H';

const pointsPath = path.join(__dirname, 'points.json');
let face = null;
let hudInterval = null;
let frame = 0;
let speaking = false;
let statusText = '';

function clamp(value, minimum, maximum) {
	return Math.max(minimum, Math.min(maximum, value));
}

function terminalSize() {
	const columns = Math.max(1, process.stdout.columns || 80);
	const rows = Math.max(2, process.stdout.rows || 24);
	return { columns, faceRows: Math.max(1, rows - 1) };
}

function loadFace() {
	if (!face) {
		face = JSON.parse(fs.readFileSync(pointsPath, 'utf8'));
	}

	return face;
}

function pointIsOn(point, pulse, random = Math.random()) {
	const brightness = clamp(Number(point.b) || 1, 0, 1);
	const threshold = clamp(brightness * (0.72 + pulse * 0.28), 0.08, 1);
	return random < threshold;
}

function renderFrame() {
	const currentFace = loadFace();
	const { columns, faceRows } = terminalSize();
	const subpixelWidth = columns * 2;
	const subpixelHeight = faceRows * 4;
	const pulseSpeed = speaking ? 0.22 : 0.09;
	const pulse = (Math.sin(frame * pulseSpeed) + 1) / 2;
	const brightnessBoost = speaking ? 0.12 : 0;
	const cells = Array.from({ length: faceRows }, () =>
		Array.from({ length: columns }, () => ({ edge: 0, scatter: 0 }))
	);

	for (const point of currentFace.points) {
		if (!pointIsOn(point, pulse + brightnessBoost)) {
			continue;
		}

		const jitter = point.type === 'scatter' ? (Math.random() - 0.5) * 1.2 : 0;
		const x = clamp(Math.round((Number(point.x) / currentFace.width) * (subpixelWidth - 1) + jitter), 0, subpixelWidth - 1);
		const y = clamp(Math.round((Number(point.y) / currentFace.height) * (subpixelHeight - 1) + jitter), 0, subpixelHeight - 1);
		const cell = cells[Math.floor(y / 4)][Math.floor(x / 2)];
		const [, , mask] = BRAILLE_DOTS.find(([dotX, dotY]) => dotX === x % 2 && dotY === y % 4);
		const type = point.type === 'scatter' ? 'scatter' : 'edge';
		cell[type] |= mask;
	}

	const lines = cells.map((row) => row.map((cell) => {
		if (cell.edge) {
			return `${CYAN}${String.fromCodePoint(0x2800 + cell.edge)}${RESET}`;
		}
		if (cell.scatter) {
			return `${DIM_CYAN}${String.fromCodePoint(0x2800 + cell.scatter)}${RESET}`;
		}
		return ' ';
	}).join(''));
	const status = statusText ? `\n${statusText.slice(0, columns)}` : '';
	process.stdout.write(`${CLEAR_HOME}${lines.join('\n')}${status}${RESET}`);
	frame += 1;
}

function startHud() {
	if (hudInterval) {
		return;
	}

	renderFrame();
	hudInterval = setInterval(renderFrame, FRAME_INTERVAL_MS);
}

function stopHud() {
	if (hudInterval) {
		clearInterval(hudInterval);
		hudInterval = null;
	}
}

function setSpeaking(value) {
	speaking = Boolean(value);
}

function setStatus(text) {
	statusText = String(text ?? '');
}

function isHudActive() {
	return hudInterval !== null;
}

module.exports = { startHud, stopHud, setSpeaking, setStatus, isHudActive };