const registry = require('./commands/registry');

function matchCommand(transcript) {
	const registryResult = registry.matchCommand(transcript);
	if (registryResult && registryResult.command && registryResult.command !== 'CHAT') {
		return registryResult;
	}

	if (typeof transcript !== 'string') {
		return { command: 'CHAT', params: { text: transcript } };
	}

	const normalizedTranscript = transcript
		.toLowerCase()
		.replace(/[’']/g, '')
		.replace(/\s+/g, ' ')
		.trim();

	const legacy = {
		SEND_TEXT: /^text\s+(.+?)\s+saying\s+(.+)$/,
		SEND_WHATSAPP: /^(?:whatsapp\s+(.+?)\s+saying\s+(.+)|send a whatsapp to\s+(.+?)\s+saying\s+(.+))$/,
		REPLY_DRAFT: /^(?:help me|draft a) reply to\s+(.+)$/,
		CONFIRM_SEND: /\b(send it|yes send)\b/,
		CANCEL_SEND: /^(?:no|cancel|dont send)$/,
		WAKE: /^(?:hello|hi|hey)(?:\s+bubu)?$|^(?:hello bubu|hi bubu|hey bubu|ok bubu|hey booboo)$/,
		STOP_SESSION: /^(?:stop|thats all|that is all|done|goodbye|bye)\b/,
		SYSTEM_STATUS: /\b(?:are you online|how are you doing|system status)\b/,
		UPDATES: /\b(?:give me the updates|what's new|what is new|update me)\b/,
		STOP_LISTENING: /\b(stop listening|mic off|go to sleep)\b/,
		START_LISTENING: /\b(wake up|mic on)\b/,
		NEXT_CLASS: /\b(next class|next lecture)\b/,
		CLASS_STATUS: /\b(is there a class|any class today|class update|do i have class)\b/,
		READ_IMPORTANT: /\bread (?:my )?important messages?\b|\bwhat did i miss\b|\bimportant messages?\b/,
		READ_MESSAGES: /\bread (?:my )?messages?\b|\bread whatsapp\b/,
		READ_TEXTS: /\bread (?:my )?texts?\b|\bread sms\b/,
		MISSED_CALLS: /\bmissed calls?\b|\bwho called\b/,
		AWAY_ON: /\baway mode on\b|\bim away\b/,
		AWAY_OFF: /\baway mode off\b|\bim back\b/,
		TELL_TIME: /\b(whats the time|what time is it|tell me the time|current time|time is it)\b/,
		PLAY_MUSIC: /\b(play me something|play music|put on a song|play a song|play some music)\b/
	};

	for (const [command, regex] of Object.entries(legacy)) {
		if (regex.test(normalizedTranscript)) {
			if (command === 'SEND_TEXT') {
				const m = normalizedTranscript.match(regex);
				return { command, params: { name: m[1].trim(), message: m[2].trim() } };
			}
			if (command === 'SEND_WHATSAPP') {
				const m = normalizedTranscript.match(regex);
				const name = (m[1] || m[3] || '').trim();
				const message = (m[2] || m[4] || '').trim();
				if (name && message) return { command, params: { name, message } };
			}
			if (command === 'REPLY_DRAFT') {
				return { command, params: { name: normalizedTranscript.match(regex)[1].trim() } };
			}
			return { command };
		}
	}

	const googleMatch = normalizedTranscript.match(/^(?:google search for|search google for|look up|search for|google)\s+(.+)$/);
	if (googleMatch) {
		const query = googleMatch[1].trim();
		if (query) {
			return { command: 'GOOGLE_SEARCH', params: { query } };
		}
	}

	const payMatch = normalizedTranscript.match(/^pay\s+([\d][\d\s,]*)\s+to\s+(\+?[\d][\d\s+\-]*)$/);
	if (payMatch) {
		const amount = payMatch[1].replace(/[\s,]/g, '');
		const number = payMatch[2].replace(/[\s\-]/g, '');
		if (amount && number) {
			return { command: 'PAY_MPESA', params: { amount, number } };
		}
	}

	const callMatch = normalizedTranscript.match(/^(?:call|phone|ring|dial)\s+(.+)$/);
	if (callMatch) {
		const name = callMatch[1].trim();
		if (name && !/^(it|that|this|them|him|her|me|back)\s+off\b/.test(name)) {
			return { command: 'CALL_CONTACT', params: { name } };
		}
	}

	return { command: 'CHAT', params: { text: transcript } };
}

module.exports = { matchCommand, ...registry };
