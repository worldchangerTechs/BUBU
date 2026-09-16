const fs = require('node:fs');
const path = require('node:path');

const FRAME_INTERVAL_MS = 125;
// Stable, capped canvas: the face is always rendered into this fixed box of
// braille cells, no matter how big the terminal gets. Points never thin out
// or redistribute as the screen grows — the cloud stays complete and fixed.
const MAX_COLUMNS = 60;
const MAX_FACE_ROWS = 40;
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
let resizeListener = null;
let frame = 0;
let speaking = false;
let statusText = '';
let hudDisabled = false;
// Render grid, computed ONCE at startup (recomputed only on 'resize').
let grid = null;

function clamp(value, minimum, maximum) {
	return Math.max(minimum, Math.min(maximum, value));
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

function computeGrid() {
	const columns = Math.max(1, Math.min(process.stdout.columns || 80, MAX_COLUMNS));
	const faceRows = Math.max(1, Math.min((process.stdout.rows || 24) - 1, MAX_FACE_ROWS));
	const terminalWidth = Math.max(1, process.stdout.columns || 80);
	// Center the fixed box inside a wider terminal.
	const leftPad = Math.max(0, Math.floor((terminalWidth - columns) / 2));
	return {
		columns,
		faceRows,
		leftPad,
		subpixelWidth: columns * 2,
		subpixelHeight: faceRows * 4
	};
}

function renderFrame() {
	const currentFace = loadFace();
	if (!grid) {
		grid = computeGrid();
	}
	const { columns, faceRows, leftPad, subpixelWidth, subpixelHeight } = grid;
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
		const x = Math.round((Number(point.x) / currentFace.width) * (subpixelWidth - 1) + jitter);
		const y = Math.round((Number(point.y) / currentFace.height) * (subpixelHeight - 1) + jitter);
		// Bounds check: skip bad-scale points instead of indexing out of range.
		const cellX = Math.floor(x / 2);
		const cellY = Math.floor(y / 4);
		if (x < 0 || y < 0 || x >= subpixelWidth || y >= subpixelHeight
			|| cellX < 0 || cellY < 0 || cellX >= columns || cellY >= faceRows) {
			continue;
		}
		const cell = cells[cellY][cellX];
		const [, , mask] = BRAILLE_DOTS.find(([dotX, dotY]) => dotX === x % 2 && dotY === y % 4);
		const type = point.type === 'scatter' ? 'scatter' : 'edge';
		cell[type] |= mask;
	}

	const paddedLines = cells.map((row) => {
		const rendered = row.map((cell) => {
			if (cell.edge) {
				return `${CYAN}${String.fromCodePoint(0x2800 + cell.edge)}${RESET}`;
			}
			if (cell.scatter) {
				return `${DIM_CYAN}${String.fromCodePoint(0x2800 + cell.scatter)}${RESET}`;
			}
			return ' ';
		}).join('');
		return `${' '.repeat(leftPad)}${rendered}`;
	});
	const status = statusText ? `\n${statusText.slice(0, columns)}` : '';
	process.stdout.write(`${CLEAR_HOME}${paddedLines.join('\n')}${status}${RESET}`);
	frame += 1;
}

function startHud() {
	if (hudInterval || hudDisabled) {
		return;
	}

	if (!process.stdout.isTTY) {
		hudDisabled = true;
		console.warn('[hud] HUD needs a real terminal, not a pipe — run with npm start, not through | tee');
		return;
	}

	// Compute the render grid ONCE; only a genuine terminal resize rebuilds it.
	grid = computeGrid();
	if (resizeListener) {
		process.stdout.off('resize', resizeListener);
	}
	resizeListener = () => {
		grid = computeGrid();
	};
	process.stdout.on('resize', resizeListener);

	renderFrame();
	hudInterval = setInterval(renderFrame, FRAME_INTERVAL_MS);
}

function stopHud() {
	if (hudInterval) {
		clearInterval(hudInterval);
		hudInterval = null;
	}
	if (resizeListener && typeof process.stdout.off === 'function') {
		process.stdout.off('resize', resizeListener);
		resizeListener = null;
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