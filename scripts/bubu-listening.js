#!/usr/bin/env node
const { setListeningState } = require('../src/voiceRouter');

const action = String(process.argv[2] || '').toLowerCase();
if (action !== 'start' && action !== 'stop') {
	console.error('Usage: npm run listen -- start|stop');
	process.exitCode = 2;
} else {
	setListeningState(action === 'start');
	console.log(action === 'start' ? 'BUBU listening requested.' : 'BUBU listening paused.');
}