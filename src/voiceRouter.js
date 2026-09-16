const { listen } = require('./termux/speechToText');
const { execFile } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { speakCloned } = require('./termux/cloudTts');
const { listSms, sendSms } = require('./termux/sms');
const { getMissedCalls } = require('./termux/callLog');
const { findContact } = require('./termux/contacts');
const { sendMessage, toWhatsAppJid } = require('./whatsapp');
const store = require('./store');
const { getRecentMessages } = require('./messageHandler');
const { matchCommand } = require('./voiceCommands');
const {
	phrase,
	CHAT_SYSTEM_PROMPT,
	REPLY_DRAFT_SYSTEM_PROMPT,
	isTimeSensitive
} = require('./personality');
const { complete } = require('./llmClient');
const { search } = require('./webSearch');
const { playForMood } = require('./moodMusic');
const { searchGoogle, callContact } = require('./termux/appLauncher');
const { setStatus } = require('./hud/terminalHud');

const chatHistory = [];
let isListening = false;
let listeningLoopPromise = null;
const UNIVERSAL_FALLBACK = "I'm sorry sir, but that is not possible for now.";
const LISTENING_STATE_PATH = path.join(os.tmpdir(), 'bubu-listening.state');
const LISTEN_RETRY_DELAY_MS = 1000;

// Idle cutoff for a wake session: ~15s of silence (no speech detected)
// ends the loop so the mic isn't held open draining battery.
const SESSION_SILENCE_LIMIT_MS = 15000;

async function handleWakeSession(firstTranscript) {
	await speakCloned(phrase('WAKE'));
	let pendingTranscript = firstTranscript;
	let lastSpeechAt = Date.now();
	for (;;) {
		// ~15s of silence ends the session so the mic isn't held open.
		if (Date.now() - lastSpeechAt >= SESSION_SILENCE_LIMIT_MS && pendingTranscript === undefined) {
			return;
		}
		let transcript = pendingTranscript;
		pendingTranscript = undefined;
		if (transcript === undefined) {
			const remainingMs = SESSION_SILENCE_LIMIT_MS - (Date.now() - lastSpeechAt);
			try {
				transcript = await listenWithTimeout(Math.max(1000, remainingMs));
			} catch (error) {
				await speakCloned(UNIVERSAL_FALLBACK);
				return;
			}
		}
		if (!String(transcript ?? '').trim()) {
			continue;
		}
		lastSpeechAt = Date.now();
		const { command } = matchCommand(transcript);
		if (command === 'STOP_SESSION' || command === 'CANCEL_SEND') {
			await speakCloned(phrase('SESSION_SIGNOFF'));
			return;
		}
		if (command === 'WAKE') {
			await speakCloned(phrase('WAKE'));
			continue;
		}
		await handleCommand(transcript);
	}
}

async function startListeningLoop() {
	if (listeningLoopPromise) {
		isListening = true;
		setListeningState(true);
		setStatus('LISTENING');
		return listeningLoopPromise;
	}

	isListening = true;
	setListeningState(true);
	setStatus('LISTENING');
	// Android only permits continuous microphone access while Termux is foreground
	// or holds termux-wake-lock; this is an OS restriction, not code we can override.
	listeningLoopPromise = (async () => {
		while (true) {
			if (!isListening) {
				if (readListeningState()) {
					isListening = true;
					setStatus('LISTENING');
					continue;
				}
				await new Promise((resolve) => setTimeout(resolve, 250));
				continue;
			}
			try {
				const transcript = await listen();
				if (String(transcript ?? '').trim()) {
					await handleCommand(transcript);
				} else {
					await new Promise((resolve) => setTimeout(resolve, LISTEN_RETRY_DELAY_MS));
				}
			} catch (error) {
				await speakCloned(UNIVERSAL_FALLBACK);
				await new Promise((resolve) => setTimeout(resolve, LISTEN_RETRY_DELAY_MS));
			}
			if (!readListeningState()) {
				isListening = false;
				setStatus('PAUSED');
			}
		}
	})().finally(() => {
		listeningLoopPromise = null;
		setStatus('PAUSED');
	});
	return listeningLoopPromise;
}

function stopListening() {
	isListening = false;
	setListeningState(false);
	setStatus('PAUSED');
}

function setListeningState(value) {
	try {
		fs.writeFileSync(LISTENING_STATE_PATH, value ? 'LISTENING\n' : 'PAUSED\n', 'utf8');
	} catch {
		// In-memory state still works when the temporary directory is unavailable.
	}
}

function readListeningState() {
	try {
		return fs.readFileSync(LISTENING_STATE_PATH, 'utf8').trim() !== 'PAUSED';
	} catch {
		return true;
	}
}

function listenWithTimeout(timeoutMs) {
	return Promise.race([
		listen(),
		new Promise((resolve) => setTimeout(() => resolve(''), timeoutMs))
	]);
}

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

	let promptUserText = userText;
	if (isTimeSensitive(userText)) {
		const results = await search(userText);
		if (results.length > 0) {
			const searchContext = results
				.slice(0, 3)
				.map((result, index) => `${index + 1}. ${result.title}\n${result.snippet}`)
				.join('\n');
			promptUserText = [
				`Original question: ${userText}`,
				'Search results:',
				searchContext,
				'Answer using only the information in the search results. If it is insufficient, say so clearly.'
			].join('\n');
		} else {
			promptUserText = `${userText}\n\nThis answer might not be current. Say so if you are uncertain.`;
		}
	}

	const prompt = [
		...chatHistory.map((entry) => `${entry.role === 'user' ? 'User' : 'Assistant'}: ${entry.text}`),
		`User: ${promptUserText}`,
		'Assistant:'
	].join('\n');

	try {
		const reply = await complete(prompt, CHAT_SYSTEM_PROMPT);
		chatHistory.push({ role: 'user', text: userText }, { role: 'assistant', text: reply });
		chatHistory.splice(0, Math.max(0, chatHistory.length - 8));
		await speakCloned(reply);
	} catch (error) {
		await speakCloned(UNIVERSAL_FALLBACK);
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

async function handleTeach(fact) {
	const text = String(fact ?? '').trim();
	if (!text) {
		await speakCloned(UNIVERSAL_FALLBACK);
		return;
	}
	// Explicit keyword-importance rule only: "X is important" teaches X.
	// Anything else is stored as a plain fact so nothing is inferred.
	const ruleMatch = text.match(/^(.+?)\s+is important$/i);
	const keyword = (ruleMatch ? ruleMatch[1] : text).toLowerCase().trim();
	if (keyword) {
		store.learnImportantWord(keyword);
	}
	await speakCloned(phrase('TEACH_SAVED', { fact: text }));
}

async function handleCallContact(name) {
	const query = String(name ?? '').trim();
	if (!query) {
		await speakCloned(UNIVERSAL_FALLBACK);
		return;
	}
	let contact;
	try {
		contact = await findContact(query);
	} catch (error) {
		await speakCloned(UNIVERSAL_FALLBACK);
		return;
	}
	if (!contact?.number) {
		await speakCloned("I couldn't find a contact matching that name");
		return;
	}
	// Misheard-name guard: ACTION.CALL dials with NO confirmation screen,
	// so announce the resolved name and give ~2s to say "cancel" first.
	await speakCloned(phrase('CALL_ANNOUNCE', { name: contact.name }));
	let objection = '';
	try {
		objection = await listenWithTimeout(2000);
	} catch {
		objection = '';
	}
	if (/\bcancel\b|\bstop\b|\bno\b|\bdont\b/.test(String(objection).toLowerCase())) {
		await speakCloned(phrase('CALL_CANCELLED'));
		return;
	}
	try {
		await callContact(contact.number);
	} catch (error) {
		await speakCloned(UNIVERSAL_FALLBACK);
	}
}

async function executeCommand(transcript) {
	const { command, params } = matchCommand(transcript);

	switch (command) {
		case 'STOP_LISTENING':
			stopListening();
			await speakCloned('Listening paused, sir.');
			return;

		case 'START_LISTENING':
			await speakCloned('Listening resumed, sir.');
			if (listeningLoopPromise) {
				startListeningLoop();
			} else {
				setListeningState(true);
			}
			return;
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

		case 'CLASS_STATUS': {
			const classStatus = store.getClassStatus();
			if (!classStatus?.hasClass) {
				await speakCloned(phrase('CLASS_STATUS_EMPTY'));
				return;
			}
			await speakCloned(phrase('CLASS_STATUS', {
				title: classStatus.title,
				time: new Date(classStatus.time).toLocaleString()
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

		case 'SEND_WHATSAPP': {
			const name = String(params?.name ?? '').trim();
			const message = String(params?.message ?? '').trim();
			if (!name || !message) {
				await speakCloned(UNIVERSAL_FALLBACK);
				return;
			}
			let contact;
			try {
				contact = await findContact(name);
			} catch (error) {
				await speakCloned(UNIVERSAL_FALLBACK);
				return;
			}
			if (!contact?.number) {
				await speakCloned("I couldn't find a contact matching that name");
				return;
			}
			// First message to a new JID works like any other via Baileys.
			try {
				await sendMessage(toWhatsAppJid(contact.number), message);
			} catch (error) {
				await speakCloned(UNIVERSAL_FALLBACK);
				return;
			}
			await speakCloned(phrase('WHATSAPP_SENT', { name: contact.name }));
			return;
		}

		case 'REPLY_DRAFT':
			try {
				await draftReply(params?.name);
			} catch (error) {
				await speakCloned(UNIVERSAL_FALLBACK);
			}
			return;

		case 'CONFIRM_SEND':
			try {
				await confirmPendingReply();
			} catch (error) {
				await speakCloned(UNIVERSAL_FALLBACK);
			}
			return;

		case 'CANCEL_SEND':
			await cancelPendingReply();
			return;

		case 'WAKE':
			await handleWakeSession();
			return;

		case 'STOP_SESSION':
			await speakCloned(phrase('SESSION_SIGNOFF'));
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
				await speakCloned(UNIVERSAL_FALLBACK);
				return;
			}
			try {
				await searchGoogle(query);
			} catch (error) {
				await speakCloned(UNIVERSAL_FALLBACK);
				return;
			}
			await speakCloned(phrase('GOOGLE_SEARCH', { query }));
			return;
		}

		case 'PAY_MPESA': {
			const amount = String(params?.amount ?? '').trim();
			const number = String(params?.number ?? '').trim();
			if (!amount || !number) {
				await speakCloned(UNIVERSAL_FALLBACK);
				return;
			}
			try {
				await handlePayMpesa(amount, number);
			} catch (error) {
				await speakCloned(UNIVERSAL_FALLBACK);
			}
			return;
		}

		case 'TEACH': {
			const fact = String(params?.fact ?? '').trim();
			if (!fact) {
				await speakCloned(UNIVERSAL_FALLBACK);
				return;
			}
			await handleTeach(fact);
			return;
		}

		case 'CALL_CONTACT': {
			const name = String(params?.name ?? '').trim();
			if (!name) {
				await speakCloned(UNIVERSAL_FALLBACK);
				return;
			}
			await handleCallContact(name);
			return;
		}

		case 'CHAT':
			await speakChatResponse(params?.text);
			return;

		default:
			await speakCloned(UNIVERSAL_FALLBACK);
	}
}

async function handleCommand(transcript) {
	try {
		return await executeCommand(transcript);
	} catch (error) {
		await speakCloned(UNIVERSAL_FALLBACK);
		return undefined;
	}
}

async function handleVoiceCommand() {
	const transcript = await listen();
	const { command } = matchCommand(transcript);
	// Widget tap starts a wake session: "hello" opens the loop, and anything
	// else runs as the first command inside the same session.
	if (command === 'WAKE') {
		await handleWakeSession();
		return;
	}
	if (command === 'STOP_SESSION') {
		await speakCloned(phrase('SESSION_SIGNOFF'));
		return;
	}
	if (!String(transcript ?? '').trim()) {
		return;
	}
	await handleWakeSession(transcript);
}

async function handleTextCommand(text) {
	return handleCommand(text);
}

module.exports = {
	handleCommand,
	handleVoiceCommand,
	handleTextCommand,
	handleWakeSession,
	startListeningLoop,
	stopListening,
	setListeningState
};
