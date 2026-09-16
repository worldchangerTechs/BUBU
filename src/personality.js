const BUBU_MASTER_SYSTEM_PROMPT = `You are BUBU, a personal voice assistant belonging to Mr. Tipape. Rules you always follow:
1. Address the user as "sir" in every spoken response.
2. On first greeting each session, say "Welcome, Mr. Tipape, sir." Otherwise keep greetings brief.
3. Be fast, warm, and clear. Keep answers short enough to comfortably speak aloud, unless the user has asked for a story, explanation, or something intentionally longer.
4. If a request can't actually be done - no matching command, a tool/API failure, or something outside what you're able to do - respond exactly: "I'm sorry sir, but that is not possible for now." Never fake an action you didn't actually perform.
5. Never claim to remember something that wasn't explicitly told to you or stored in your profile. Never invent facts about the user.
6. You are a tool that helps with tasks - not a substitute for real relationships, professional help, or people the user can actually talk to. If something serious comes up (distress, isolation, health), gently point toward a real person, without repeating that every single time.`;

const CHAT_SYSTEM_PROMPT = [
	BUBU_MASTER_SYSTEM_PROMPT,
	'Be funny when it fits, but never at the user\'s expense.'
].join(' ');

function isTimeSensitive(question) {
	return /\b(today|tonight|tomorrow|yesterday|current|currently|latest|recent|now|news|weather|forecast|price|cost|stock|score|schedule|event|deadline|version|release|who is|what is happening)\b/i.test(String(question ?? ''));
}

const AWAY_REPLY_SYSTEM_PROMPT = [
	'Write one brief, friendly reply to the incoming message.',
	'Explain that the owner is currently away and will respond later.',
	'Do not promise a specific time, make commitments, or state facts not provided in the incoming message.',
	'Keep it warm and natural, with a light touch of humor only when it fits.'
].join(' ');

const REPLY_DRAFT_SYSTEM_PROMPT = [
	'Write one short, friendly reply to the supplied message.',
	'Reply naturally to the message content and do not invent facts, promises, or commitments.',
	'Return only the reply text, without quotation marks or explanation.'
].join(' ');

const variants = {
	ALARM_SET: [
		({ title, time }) => `${title || 'That event'}, ${time || 'on the calendar'} - locked in! I've got the alarm set.`,
		({ title, time }) => `Alarm's set for ${title || 'your event'}${time ? ` at ${time}` : ''}. Future you is going to be delighted.`,
		({ title, time }) => `${title || 'Your reminder'} is all set${time ? ` for ${time}` : ''}. Consider it officially on the radar.`
	],
	AWAY_ON: [
		() => 'Away mode is on. I will keep things tidy while you are out.',
		() => 'You are officially away. I will hold the fort.',
		() => 'Away mode activated. Go do your thing; I have the quiet bits covered.'
	],
	AWAY_OFF: [
		() => 'Welcome back. Away mode is off and I am ready to help.',
		() => 'You are back in the building. Away mode is now off.',
		() => 'Back online together. Away mode is off.'
	],
	DIGEST_EMPTY: [
		() => 'Nothing important right now - you are all caught up!',
		() => 'The important-message shelf is empty. Nice and peaceful.',
		() => 'All clear for now. Nothing important is waiting.'
	],
	REPLY_DRAFT: [
		() => 'Here is a short reply draft for you.',
		() => 'I drafted something you can send.',
		() => 'Freshly drafted and ready for your review.'
	],
	REPLY_SENT: [
		() => 'Sent. Nicely handled.',
		() => 'That reply is on its way.',
		() => 'Done - your reply has been sent.'
	],
	DIGEST_ITEM: [
		details => digestLine(details, 'plain'),
		details => digestLine(details, 'warm'),
		details => digestLine(details, 'brief')
	],
	CONTACT_NOT_FOUND: [
		({ name }) => `I could not find ${name || 'that contact'}, but we can try again with a different name.`,
		({ name }) => `${name || 'That contact'} is playing hide-and-seek. I could not find them yet.`,
		() => 'I could not find that contact. Check the name and we will give it another go.'
	],
	UNKNOWN_COMMAND: [
		() => 'I did not quite catch that. Try saying it another way and I am with you.',
		() => 'That command slipped past me. Give me another try.',
		() => 'I am not sure what you meant yet, but I am ready for a rerun.'
	],
	TELL_TIME: [
		({ time }) => `It's ${time || 'time to check the clock'} right now.`,
		({ time }) => `The time is ${time || 'on the clock'}.`,
		({ time }) => `Right now it's ${time || 'about that time'}.`
	],
	MUSIC_ASK_MOOD: [
		() => 'What mood are you in?',
		() => 'Tell me the vibe — what mood are you in?',
		() => 'What kind of mood should I play for?'
	],
	MUSIC_MISSED_MOOD: [
		() => "Didn't catch that — try again",
		() => 'I did not hear a mood — try again?',
		() => 'Hmm, missed that — tell me the mood again?'
	],
	MUSIC_LOCAL: [
		() => 'Playing something from your library',
		() => 'Found a match in your library — playing it now.',
		() => 'Pulling a track from your own collection.'
	],
	MUSIC_YOUTUBE: [
		() => 'Opening something on YouTube for that mood',
		() => 'Nothing local matched, so opening a YouTube mix for that mood.',
		() => 'Heading to YouTube to find that vibe for you.'
	],
	GOOGLE_SEARCH: [
		() => "Here's what I found for that",
		({ query }) => `Here's what I found for ${query || 'that'}.`,
		() => 'Pulled that up on Google for you.'
	],
	MPESA_CONFIRM: [
		({ amount, number }) => `You said pay ${amount || 'that amount'} shillings to ${number || 'that number'}. Is that right?`,
		({ amount, number }) => `Just to double-check: pay ${amount || 'that amount'} shillings to ${number || 'that number'} — correct?`,
		({ amount, number }) => `I heard pay ${amount || 'that amount'} shillings to ${number || 'that number'}. Is that right?`
	],
	MPESA_OPEN: [
		() => 'Opening M-Pesa — go ahead and enter the amount, number, and your PIN',
		() => 'M-Pesa menu coming up — enter the amount, number, and your PIN by hand.',
		() => 'Opening the M-Pesa menu for you — you take it from there with amount, number, and PIN.'
	],
	MPESA_CANCELLED: [
		() => 'Okay, cancelled',
		() => 'No problem — cancelled, nothing opened.',
		() => 'Got it, cancelled. Let me know if you want to try again.'
	],
	WAKE: [
		() => 'Hey! I am listening — what do you need?',
		() => 'Hi there! What can I do for you?',
		() => 'Hello! Go ahead, I am all ears.'
	],
	SESSION_SIGNOFF: [
		() => 'Got it — going quiet. Just say hello when you need me.',
		() => 'All done. I will be right here when you call.',
		() => 'Okay, signing off for now. Holler when you need me.'
	],
	TEACH_SAVED: [
		({ fact }) => `Got it — I'll treat ${fact || 'that'} as important from now on.`,
		({ fact }) => `Learned: ${fact || 'that'} is important. I'll watch for it.`,
		() => 'Noted — I will remember that going forward.'
	],
	CALL_ANNOUNCE: [
		({ name }) => `Calling ${name || 'them'}. Say cancel to stop`,
		({ name }) => `Dialing ${name || 'them'} now — say cancel if that's wrong.`,
		({ name }) => `Putting the call through to ${name || 'them'}. Say cancel to stop me.`
	],
	CALL_CANCELLED: [
		() => 'Okay, not calling.',
		() => 'Call cancelled — nothing dialed.',
		() => 'Got it, I cancelled the call.'
	],
	WHATSAPP_SENT: [
		({ name }) => `WhatsApp sent to ${name || 'them'}. Nicely done.`,
		({ name }) => `That's on its way to ${name || 'them'} on WhatsApp.`,
		({ name }) => `Sent to ${name || 'them'} on WhatsApp.`
	],
	CLASS_STATUS_EMPTY: [
		() => 'No class announced right now.',
		() => 'There is no class announcement right now.',
		() => 'Nothing on the class radar right now.'
	],
	CLASS_STATUS: [
		({ title, time }) => `Yes - ${title || 'a class'} at ${time || 'the announced time'}. Alarm's already set.`,
		({ title, time }) => `Yes, ${title || 'there is a class'} at ${time || 'the announced time'}. Alarm's already set.`,
		({ title, time }) => `${title || 'A class is announced'} at ${time || 'the announced time'}. The alarm is already set.`
	]
};

function digestLine(details, style) {
	if (details.kind === 'nextClass') {
		const time = details.time ? ` at ${details.time}` : '';
		return style === 'warm'
			? `Next up is ${details.title || 'class'}${time}. You have got this.`
			: `Your next class is ${details.title || 'on the schedule'}${time}. ${style === 'brief' ? 'Nicely lined up.' : 'You have got this.'}`;
	}
	if (details.kind === 'message') {
		return style === 'warm'
			? `${details.chatName || 'Your chat'} sent this your way: ${details.text || ''}.`
			: `${style === 'brief' ? 'From' : 'Message from'} ${details.chatName || 'your chat'}: ${details.text || ''}.`;
	}
	if (details.kind === 'text') {
		return `Text from ${details.from || 'your contact'}: ${details.text || ''}.`;
	}
	if (details.kind === 'call') {
		const caller = details.name || details.number || 'a caller';
		const number = details.name && details.number ? `, ${details.number}` : '';
		return style === 'warm'
			? `${caller} tried to reach you${number}.`
			: `Missed call from ${caller}${number}.`;
	}
	if (details.kind === 'sent') {
		return `Message sent to ${details.name || 'your contact'}. Nicely done.`;
	}

	const label = details.priority === 'CLASS' ? 'Class' : 'Important';
	return `${label}: ${details.text || 'a message for you'}.`;
}

function phrase(eventType, details = {}) {
	const choices = variants[eventType] || variants.UNKNOWN_COMMAND;
	const selected = choices[Math.floor(Math.random() * choices.length)];
	return selected(details);
}

module.exports = {
	phrase,
	BUBU_MASTER_SYSTEM_PROMPT,
	CHAT_SYSTEM_PROMPT,
	isTimeSensitive,
	AWAY_REPLY_SYSTEM_PROMPT,
	REPLY_DRAFT_SYSTEM_PROMPT
};
