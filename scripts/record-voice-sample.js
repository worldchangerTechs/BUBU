const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFile } = require('node:child_process');

const outputPath = path.join(os.homedir(), 'voice_sample.wav');

console.log('Recording... say your sample phrase now');

execFile('termux-microphone-record', ['-f', outputPath, '-l', '8'], (error) => {
	if (error) {
		if (error.code === 'ENOENT') {
			console.error('Recording failed: termux-microphone-record is unavailable. Run this script inside Android Termux and install Termux:API.');
			process.exitCode = 1;
			return;
		}

		console.error(`Recording failed: ${error.message}`);
		process.exitCode = 1;
		return;
	}

	if (!fs.existsSync(outputPath)) {
		console.error(`Recording command completed, but ${outputPath} was not written.`);
		process.exitCode = 1;
		return;
	}

	console.log(`Recording saved to ${outputPath}`);
});