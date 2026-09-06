const { listen } = require('./termux/speechToText');
const { speak } = require('./termux/tts');
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
				await speak('You have no upcoming classes saved');
				return;
			}

			const eventDate = new Date(event.date);
			await speak(`Your next class is ${event.title} at ${eventDate.toLocaleString()}`);
			return;
		}

		case 'READ_MESSAGES': {
			const messages = getRecentMessages();
			for (const message of messages) {
				await speak(`Message from ${message.chatName}: ${message.text}`);
			}
			return;
		}

		case 'READ_TEXTS': {
			const messages = await listSms(3);
			for (const message of messages) {
				await speak(`Text from ${message.from}: ${message.body}`);
			}
			return;
		}

		case 'MISSED_CALLS': {
			const calls = await getMissedCalls(3);
			for (const call of calls) {
				await speak(`Missed call from ${call.name} ${call.number}`);
			}
			return;
		}

		case 'AWAY_ON':
			store.setAwayMode(true);
			await speak('Away mode is now on');
			return;

		case 'AWAY_OFF':
			store.setAwayMode(false);
			await speak('Away mode is now off');
			return;

		case 'SEND_TEXT': {
			const contact = await findContact(params?.name);
			if (!contact) {
				await speak('Contact not found');
				return;
			}

			await sendSms(contact.number, params.message);
			await speak(`Text sent to ${contact.name}`);
			return;
		}

		default:
			await speak("Sorry, I didn't understand that");
	}
}

module.exports = { handleVoiceCommand };
