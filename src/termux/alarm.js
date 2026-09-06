const { execFile } = require('node:child_process');
const logger = require('../logger');

async function setAlarm(date, label) {
	if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
		throw new TypeError('setAlarm requires a valid Date object.');
	}

	return new Promise((resolve, reject) => {
		const args = [
			'start',
			'-a', 'android.intent.action.SET_ALARM',
			'-e', 'android.intent.extra.alarm.HOUR', String(date.getHours()),
			'-e', 'android.intent.extra.alarm.MINUTES', String(date.getMinutes()),
			'-e', 'android.intent.extra.alarm.MESSAGE', String(label ?? ''),
			'-e', 'android.intent.extra.alarm.SKIP_UI', 'true'
		];

		// SKIP_UI may not be honored on all phone brands.
		execFile('am', args, (error) => {
			if (!error) {
				resolve();
				return;
			}

			if (error.code === 'ENOENT') {
				logger.warn('am unavailable; Android alarm was skipped. Run this in Termux on Android.');
				resolve();
				return;
			}

			if (error.code === 'EACCES' || /permission denied/i.test(error.message)) {
				reject(new Error('am permission was denied. Check Android and Termux permissions.'));
				return;
			}

			reject(new Error(`am failed to set the alarm: ${error.message}`));
		});
	});
}

module.exports = { setAlarm };
