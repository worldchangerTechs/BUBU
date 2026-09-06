const { execFile } = require('node:child_process');
const logger = require('../logger');

async function findContact(name) {
	if (typeof name !== 'string' || !name.trim()) {
		return null;
	}

	return new Promise((resolve, reject) => {
		execFile('termux-contact-list', [], (error, stdout) => {
			if (error) {
				if (error.code === 'ENOENT') {
					logger.warn('termux-contact-list unavailable; contact lookup skipped. Install Termux:API.');
					resolve(null);
					return;
				}

				if (error.code === 'EACCES' || /permission denied/i.test(error.message)) {
					reject(new Error('termux-contact-list permission was denied. Check Termux:API permissions.'));
					return;
				}

				reject(new Error(`termux-contact-list failed: ${error.message}`));
				return;
			}

			try {
				const contacts = JSON.parse(stdout);
				if (!Array.isArray(contacts)) {
					throw new TypeError('expected a JSON array');
				}

				const searchName = name.trim().toLowerCase();
				const match = contacts.find((contact) =>
					typeof contact.name === 'string' && contact.name.toLowerCase().includes(searchName)
				);

				resolve(match ? { name: match.name, number: match.number } : null);
			} catch (parseError) {
				reject(new Error(`termux-contact-list returned invalid JSON: ${parseError.message}`));
			}
		});
	});
}

module.exports = { findContact };
