const { listen } = require('./termux/speechToText');
const { execFile } = require('node:child_process');
const { speakCloned } = require('./termux/cloudTts');
const { listSms, sendSms } = require('./termux/sms');
const { getMissedCalls } = require('./termux/callLog');
const { findContact } = require('./termux/contacts');
const { sendMessage } = require('./whatsapp');
const store = require('./store');
const { getRecentMessages } = require('./messageHandler');
const { matchCommand } = require('./voiceCommands');
const {
	phrase,
	CHAT_SYSTEM_PROMPT,
	REPLY_DRAFT_SYSTEM_PROMPT
} = require('./personality');
const { complete } = require('./llmClient');
const { playForMood } = require('./moodMusic');
const { searchGoogle } = require('./termux/appLauncher');

const chatHistory = [];

function findWhatsAppMessage(name) {
	const normalizedName = String(name).toLowerCase();
	return getRecentMessages()
		.slice()
		.reverse()
		.find((message) => String(message.chatName).toLowerCase().includes(normalizedName));
}

async function findSmsMessage(name) {
	const normalizedName = String(name).toLowerCase();
	const messages = await listSms(10);
	return messages
		.slice()
		.sort((first, second) => new Date(second.date) - new Date(first.date))
		.find((message) => String(message.from).toLowerCase().includes(normalizedName));
}

async function draftReply(name) {
	const whatsappMessage = findWhatsAppMessage(name);
	let source = whatsappMessage;
	let channel = 'whatsapp';
	if (!source) {
		source = await findSmsMessage(name);
		channel = 'sms';
	}

	if (!source) {
		await speakCloned(phrase('CONTACT_NOT_FOUND', { name }));
		return;
	}

	const draft = await complete(`Message from ${name}: ${source.text || source.body}`, REPLY_DRAFT_SYSTEM_PROMPT);
	const recipient = channel === 'whatsapp' ? source.senderJid || source.chatName : source.from;
	store.setPendingReply({ channel, to: recipient, text: draft });
	await speakCloned(`${phrase('REPLY_DRAFT')} ${draft}`);
}

async function confirmPendingReply() {
	const pendingReply = store.getPendingReply();
	if (!pendingReply) {
		await speakCloned("There's nothing to send");
		return;
	}

	if (pendingReply.channel === 'whatsapp') {
		await sendMessage(pendingReply.to, pendingReply.text);
	} else {
		await sendSms(pendingReply.to, pendingReply.text);
	}
	store.clearPendingReply();
	await speakCloned(phrase('REPLY_SENT'));
}

async function cancelPendingReply() {
	if (!store.getPendingReply()) {
		await speakCloned("There's nothing to send");
		return;
	}

	await speakCloned('Okay, not sending that');
	store.clearPendingReply();
}

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

async function handlePlayMusic() {
	await speakCloned(phrase('MUSIC_ASK_MOOD'));
	const moodText = await listen();
	if (!String(moodText || '').trim()) {
		await speakCloned(phrase('MUSIC_MISSED_MOOD'));
		return;
	}
	const result = await playForMood(moodText);
	if (result?.source === 'local') {
		await speakCloned(phrase('MUSIC_LOCAL'));
		return;
	}
	await speakCloned(phrase('MUSIC_YOUTUBE'));
}

async function handlePayMpesa(amount, number) {
	// Safety check: speak back exactly what was heard so a misheard digit
	// gets caught before anything happens. Nothing is auto-typed or auto-dialed.
	await speakCloned(phrase('MPESA_CONFIRM', { amount, number }));
	const confirmation = String(await listen() || '').toLowerCase().trim();
	if (!/^(yes|yeah|yep|correct|right|confirm|sawa|ndio|eee|eh)$/.test(confirmation)
		&& !/\b(yes|yeah|yep|correct|thats right|that is right|confirm|sawa|ndio)\b/.test(confirmation)) {
		await speakCloned(phrase('MPESA_CANCELLED'));
		return;
	}
	// Open the dialer pre-loaded with the M-Pesa menu shortcut.
	// ACTION_CALL with a tel: URI only opens the dialer here — it does NOT
	// place the call or type the amount/recipient; the user enters amount,
	// number, and PIN by hand. %23 is the URL-encoded '#'.
	await new Promise((resolve, reject) => {
		execFile('am', ['start', '-a', 'android.intent.action.CALL', '-d', 'tel:*334%23'], (error) => {
			if (error) {
				reject(new Error(error.code === 'ENOENT'
					? 'am is unavailable on this device.'
					: `Could not open the dialer: ${error.message}`));
				return;
			}
			resolve();
		});
	});
	await speakCloned(phrase('MPESA_OPEN'));
}

async function handleCommand(transcript) {
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

		case 'REPLY_DRAFT':
			try {
				await draftReply(params?.name);
			} catch (error) {
				await speakCloned(`I could not draft that reply. ${error.message}`);
			}
			return;

		case 'CONFIRM_SEND':
			try {
				await confirmPendingReply();
			} catch (error) {
				await speakCloned(`I could not send that reply. ${error.message}`);
			}
			return;

		case 'CANCEL_SEND':
			await cancelPendingReply();
			return;

		case 'TELL_TIME': {
			const time = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
			await speakCloned(phrase('TELL_TIME', { time }));
			return;
		}

		case 'PLAY_MUSIC':
			await handlePlayMusic();
			return;

		case 'GOOGLE_SEARCH': {
			const query = String(params?.query ?? '').trim();
			if (!query) {
				await speakCloned(phrase('UNKNOWN_COMMAND'));
				return;
			}
			try {
				await searchGoogle(query);
			} catch (error) {
				await speakCloned(`I could not open that search. ${error.message}`);
				return;
			}
			await speakCloned(phrase('GOOGLE_SEARCH', { query }));
			return;
		}

		case 'PAY_MPESA': {
			const amount = String(params?.amount ?? '').trim();
			const number = String(params?.number ?? '').trim();
			if (!amount || !number) {
				await speakCloned(phrase('UNKNOWN_COMMAND'));
				return;
			}
			try {
				await handlePayMpesa(amount, number);
			} catch (error) {
				await speakCloned(`I could not open M-Pesa. ${error.message}`);
			}
			return;
		}

		case 'CHAT':
			await speakChatResponse(params?.text);
			return;

		default:
			await speakCloned(phrase('UNKNOWN_COMMAND'));
	}
}

async function handleVoiceCommand() {
	const transcript = await listen();
	return handleCommand(transcript);
}

async function handleTextCommand(text) {
	return handleCommand(text);
}

module.exports = { handleCommand, handleVoiceCommand, handleTextCommand };
