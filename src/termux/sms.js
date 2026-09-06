const { execFile } = require('node:child_process');
const logger = require('../logger');

function commandError(command, error) {
	if (error.code === 'ENOENT') {
		return new Error(`${command} was not found. Install Termux:API in Termux.`);
	}

	if (error.code === 'EACCES' || /permission denied/i.test(error.message)) {
		return new Error(`${command} permission was denied. Check Termux:API permissions.`);
	}

	return new Error(`${command} failed: ${error.message}`);
}

async function listSms(limit = 5) {
	return new Promise((resolve, reject) => {
		execFile('termux-sms-list', ['-l', String(limit)], (error, stdout) => {
			if (error) {
				if (error.code === 'ENOENT') {
					logger.warn('termux-sms-list unavailable; SMS list is empty. Install Termux:API.');
					resolve([]);
					return;
				}

				reject(commandError('termux-sms-list', error));
				return;
			}

			try {
				const messages = JSON.parse(stdout);
				if (!Array.isArray(messages)) {
					throw new TypeError('expected a JSON array');
				}

				resolve(messages.map((message) => ({
					from: message.number ?? message.sender ?? message.from ?? null,
					body: message.body ?? null,
					date: message.received ?? message.date ?? null
				})));
			} catch (parseError) {
				reject(new Error(`termux-sms-list returned invalid JSON: ${parseError.message}`));
			}
		});
	});
}

async function sendSms(number, message) {
	return new Promise((resolve, reject) => {
		execFile('termux-sms-send', ['-n', String(number), String(message)], (error) => {
			if (error) {
				if (error.code === 'ENOENT') {
					logger.warn('termux-sms-send unavailable; SMS was not sent. Install Termux:API.');
					resolve(false);
					return;
				}

				reject(commandError('termux-sms-send', error));
				return;
			}

			resolve();
		});
	});
}

module.exports = { listSms, sendSms };
