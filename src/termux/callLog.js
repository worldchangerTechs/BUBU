const { execFile } = require('node:child_process');
const logger = require('../logger');

async function getMissedCalls(limit = 5) {
	return new Promise((resolve, reject) => {
		execFile('termux-call-log', ['-l', String(limit)], (error, stdout) => {
			if (error) {
				if (error.code === 'ENOENT') {
					logger.warn('termux-call-log unavailable; missed-call list is empty. Install Termux:API.');
					resolve([]);
					return;
				}

				if (error.code === 'EACCES' || /permission denied/i.test(error.message)) {
					reject(new Error('termux-call-log permission was denied. Check Termux:API permissions.'));
					return;
				}

				reject(new Error(`termux-call-log failed: ${error.message}`));
				return;
			}

			try {
				const calls = JSON.parse(stdout);
				if (!Array.isArray(calls)) {
					throw new TypeError('expected a JSON array');
				}

				resolve(calls
					.filter((call) => call.type === 'MISSED')
					.map((call) => ({
						name: typeof call.name === 'string' && call.name.trim() ? call.name : call.number,
						number: call.number,
						date: call.date
					})));
			} catch (parseError) {
				reject(new Error(`termux-call-log returned invalid JSON: ${parseError.message}`));
			}
		});
	});
}

module.exports = { getMissedCalls };
