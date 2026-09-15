const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFile } = require('node:child_process');
const logger = require('./logger');

// Mood keyword -> tuned YouTube search query.
const MOOD_QUERIES = {
	happy: 'feel good upbeat songs playlist',
	sad: 'sad emotional songs playlist',
	chill: 'chill relaxed lofi playlist',
	hype: 'hype workout party songs playlist',
	angry: 'angry heavy rock rap playlist',
	romantic: 'romantic love songs playlist',
	focus: 'deep focus study instrumental playlist'
};

const GENERIC_QUERY = 'popular music playlist';
const AUDIO_EXTENSIONS = new Set(['.mp3', '.m4a', '.flac', '.wav']);

function musicDir() {
	return path.join(os.homedir(), 'storage', 'shared', 'Music');
}

function moodWords(moodText) {
	return String(moodText || '')
		.toLowerCase()
		.replace(/[^a-z0-9\s]/g, ' ')
		.split(/\s+/)
		.filter((word) => word.length > 2);
}

function listAudioFiles(dir) {
	let entries;
	try {
		entries = fs.readdirSync(dir, { withFileTypes: true });
	} catch {
		return [];
	}
	const files = [];
	for (const entry of entries) {
		const fullPath = path.join(dir, entry.name);
		if (entry.isFile() && AUDIO_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
			files.push(fullPath);
		} else if (entry.isDirectory()) {
			// One level of subfolders is enough.
			let nested;
			try {
				nested = fs.readdirSync(fullPath, { withFileTypes: true });
			} catch {
				continue;
			}
			for (const child of nested) {
				if (child.isFile() && AUDIO_EXTENSIONS.has(path.extname(child.name).toLowerCase())) {
					files.push(path.join(fullPath, child.name));
				}
			}
		}
	}
	return files;
}

function findLocalTrack(moodText) {
	const words = moodWords(moodText);
	if (words.length === 0) {
		return null;
	}
	const files = listAudioFiles(musicDir());
	for (const filePath of files) {
		const fileName = path.basename(filePath).toLowerCase();
		if (words.some((word) => fileName.includes(word))) {
			return filePath;
		}
	}
	return null;
}

function runCommand(binary, args) {
	return new Promise((resolve, reject) => {
		execFile(binary, args, (error) => {
			if (error) {
				if (error.code === 'ENOENT') {
					reject(new Error(`${binary} is unavailable. Install Termux:API to enable music playback.`));
					return;
				}
				reject(new Error(`${binary} failed: ${error.message}`));
				return;
			}
			resolve();
		});
	});
}

async function playLocalTrack(filePath) {
	await runCommand('termux-media-player', ['play', filePath]);
}

function moodQuery(moodText) {
	const normalized = String(moodText || '').toLowerCase();
	for (const [mood, query] of Object.entries(MOOD_QUERIES)) {
		if (normalized.includes(mood)) {
			return query;
		}
	}
	return GENERIC_QUERY;
}

async function searchYouTube(moodText) {
	const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(moodQuery(moodText))}`;
	await runCommand('termux-open-url', [url]);
	return url;
}

async function playForMood(moodText) {
	const localTrack = findLocalTrack(moodText);
	if (localTrack) {
		try {
			await playLocalTrack(localTrack);
			return { source: 'local', track: localTrack };
		} catch (error) {
			logger.warn(`[music] Local playback failed, falling back to YouTube: ${error.message}`);
		}
	}
	await searchYouTube(moodText);
	return { source: 'youtube' };
}

module.exports = { MOOD_QUERIES, findLocalTrack, playLocalTrack, searchYouTube, playForMood };
