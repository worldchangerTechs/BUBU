const { listen } = require('./termux/speechToText');
const { speakCloned } = require('./termux/cloudTts');
const { listSms, sendSms } = require('./termux/sms');
const { getMissedCalls } = require('./termux/callLog');
const { findContact } = require('./termux/contacts');
const store = require('./store');
const { getRecentMessages } = require('./messageHandler');
const { matchCommand } = require('./voiceCommands');

async function handleVoiceCommand() {
	const transcript = await listen();
	const { command, params } = matchCommand(transcript);

	switch (command) {
		case 'NEXT_CLASS': {
			const event = store.getNextEvent();
			if (!event) {
				await speakCloned('You have no upcoming classes saved');
				return;
			}

			const eventDate = new Date(event.date);
			await speakCloned(`Your next class is ${event.title} at ${eventDate.toLocaleString()}`);
			return;
		}

		case 'READ_MESSAGES': {
			const messages = getRecentMessages();
			for (const message of messages) {
				await speakCloned(`Message from ${message.chatName}: ${message.text}`);
			}
			return;
		}

		case 'READ_IMPORTANT': {
			const digest = store.getDigest();
			if (digest.length === 0) {
				await speakCloned('Nothing important right now');
				return;
			}

			for (const item of digest) {
				const label = item.priority === 'CLASS' ? 'Class' : 'Important';
				await speakCloned(`${label}: ${item.text}`);
			}
			store.clearDigest();
			return;
		}

		case 'READ_TEXTS': {
			const messages = await listSms(3);
			for (const message of messages) {
				await speakCloned(`Text from ${message.from}: ${message.body}`);
			}
			return;
		}

		case 'MISSED_CALLS': {
			const calls = await getMissedCalls(3);
			for (const call of calls) {
				await speakCloned(`Missed call from ${call.name} ${call.number}`);
			}
			return;
		}

		case 'AWAY_ON':
			store.setAwayMode(true);
			await speakCloned('Away mode is now on');
			return;

		case 'AWAY_OFF':
			store.setAwayMode(false);
			await speakCloned('Away mode is now off');
			return;

		case 'SEND_TEXT': {
			const contact = await findContact(params?.name);
			if (!contact) {
				await speakCloned('Contact not found');
				return;
			}

			await sendSms(contact.number, params.message);
			await speakCloned(`Text sent to ${contact.name}`);
			return;
		}

		default:
			await speakCloned("Sorry, I didn't understand that");
	}
}

module.exports = { handleVoiceCommand };
