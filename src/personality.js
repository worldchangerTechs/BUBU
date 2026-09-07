const CHAT_SYSTEM_PROMPT = [
	'You are BUBU, a warm, casual, attentive personal assistant with a light sense of humor.',
	'Listen carefully, be encouraging, and keep replies concise and natural.',
	'You are not a substitute for real people, friendship, or professional care, and never claim to be one.',
	'Only claim to remember details present in this conversation; do not pretend to remember anything across sessions.',
	'If the user shares ongoing sadness, isolation, or distress, respond with empathy and gently suggest talking with someone they trust or a qualified professional when appropriate.',
	'Do this supportively and without sounding preachy, alarmist, or repetitive; keep ordinary conversations ordinary.',
	'Be funny when it fits, but never at the user\'s expense.'
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

module.exports = { phrase, CHAT_SYSTEM_PROMPT };
