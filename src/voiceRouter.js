const { listen } = require('./termux/speechToText');
const { speakCloned } = require('./termux/cloudTts');
const { listSms, sendSms } = require('./termux/sms');
const { getMissedCalls } = require('./termux/callLog');
const { findContact } = require('./termux/contacts');
const store = require('./store');
const { getRecentMessages } = require('./messageHandler');
const { matchCommand } = require('./voiceCommands');
const { phrase, CHAT_SYSTEM_PROMPT } = require('./personality');
const { complete } = require('./llmClient');

const chatHistory = [];

async function speakChatResponse(text) {
	const userText = String(text ?? '').trim();
	if (!userText) {
		await speakCloned('I did not hear a question. Try saying that again.');
		return;
	}

	const prompt = [
		...chatHistory.map((entry) => `${entry.role === 'user' ? 'User' : 'Assistant'}: ${entry.text}`),
		`User: ${userText}`,
		'Assistant:'
	].join('\n');

	try {
		const reply = await complete(prompt, CHAT_SYSTEM_PROMPT);
		chatHistory.push({ role: 'user', text: userText }, { role: 'assistant', text: reply });
		chatHistory.splice(0, Math.max(0, chatHistory.length - 8));
		await speakCloned(reply);
	} catch (error) {
		await speakCloned(`I could not reach my local conversation model. ${error.message}`);
	}
}

async function handleVoiceCommand() {
	const transcript = await listen();
	const { command, params } = matchCommand(transcript);

	switch (command) {
		case 'NEXT_CLASS': {
			const event = store.getNextEvent();
			if (!event) {
				await speakCloned(phrase('DIGEST_EMPTY'));
				return;
			}

			const eventDate = new Date(event.date);
			await speakCloned(phrase('DIGEST_ITEM', {
				kind: 'nextClass',
				title: event.title,
				time: eventDate.toLocaleString()
			}));
			return;
		}

		case 'READ_MESSAGES': {
			const messages = getRecentMessages();
			for (const message of messages) {
				await speakCloned(phrase('DIGEST_ITEM', { ...message, kind: 'message' }));
			}
			return;
		}

		case 'READ_IMPORTANT': {
			const digest = store.getDigest();
			if (digest.length === 0) {
				await speakCloned(phrase('DIGEST_EMPTY'));
				return;
			}

			for (const item of digest) {
				const label = item.priority === 'CLASS' ? 'Class' : 'Important';
				await speakCloned(phrase('DIGEST_ITEM', { ...item, priority: label }));
			}
			store.clearDigest();
			return;
		}

		case 'READ_TEXTS': {
			const messages = await listSms(3);
			for (const message of messages) {
				await speakCloned(phrase('DIGEST_ITEM', {
					kind: 'text',
					from: message.from,
					text: message.body
				}));
			}
			return;
		}

		case 'MISSED_CALLS': {
			const calls = await getMissedCalls(3);
			for (const call of calls) {
				await speakCloned(phrase('DIGEST_ITEM', { ...call, kind: 'call' }));
			}
			return;
		}

		case 'AWAY_ON':
			store.setAwayMode(true);
			await speakCloned(phrase('AWAY_ON'));
			return;

		case 'AWAY_OFF':
			store.setAwayMode(false);
			await speakCloned(phrase('AWAY_OFF'));
			return;

		case 'SEND_TEXT': {
			const contact = await findContact(params?.name);
			if (!contact) {
				await speakCloned(phrase('CONTACT_NOT_FOUND', { name: params?.name }));
				return;
			}

			await sendSms(contact.number, params.message);
			await speakCloned(phrase('DIGEST_ITEM', { kind: 'sent', name: contact.name }));
			return;
		}

		case 'CHAT':
			await speakChatResponse(params?.text);
			return;

		default:
			await speakCloned(phrase('UNKNOWN_COMMAND'));
	}
}

module.exports = { handleVoiceCommand };
