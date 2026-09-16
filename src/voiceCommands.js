function matchCommand(transcript) {
	if (typeof transcript !== 'string') {
		return { command: 'CHAT', params: { text: transcript } };
	}

	const normalizedTranscript = transcript
		.toLowerCase()
		.replace(/[’']/g, '')
		.replace(/\s+/g, ' ')
		.trim();

	const sendTextMatch = normalizedTranscript.match(/^text\s+(.+?)\s+saying\s+(.+)$/);
	if (sendTextMatch) {
		return {
			command: 'SEND_TEXT',
			params: {
				name: sendTextMatch[1].trim(),
				message: sendTextMatch[2].trim()
			}
		};
	}

	const sendWhatsappMatch = normalizedTranscript.match(/^(?:whatsapp\s+(.+?)\s+saying\s+(.+)|send a whatsapp to\s+(.+?)\s+saying\s+(.+))$/);
	if (sendWhatsappMatch) {
		const name = (sendWhatsappMatch[1] || sendWhatsappMatch[3] || '').trim();
		const message = (sendWhatsappMatch[2] || sendWhatsappMatch[4] || '').trim();
		if (name && message) {
			return { command: 'SEND_WHATSAPP', params: { name, message } };
		}
	}

	const replyDraftMatch = normalizedTranscript.match(/^(?:help me|draft a) reply to\s+(.+)$/);
	if (replyDraftMatch) {
		return {
			command: 'REPLY_DRAFT',
			params: { name: replyDraftMatch[1].trim() }
		};
	}

	if (/\b(send it|yes send)\b/.test(normalizedTranscript)) {
		return { command: 'CONFIRM_SEND' };
	}
	if (/^(?:no|cancel|dont send)$/.test(normalizedTranscript)) {
		return { command: 'CANCEL_SEND' };
	}

	if (/^(?:hello|hi|hey)(?:\s+bubu)?$/.test(normalizedTranscript)
		|| /^(?:hello bubu|hi bubu|hey bubu|ok bubu|hey booboo)$/.test(normalizedTranscript)) {
		return { command: 'WAKE' };
	}

	if (/^(?:stop|thats all|that is all|done|goodbye|bye)\b/.test(normalizedTranscript)) {
		return { command: 'STOP_SESSION' };
	}
	if (/\b(stop listening|mic off|go to sleep)\b/.test(normalizedTranscript)) {
		return { command: 'STOP_LISTENING' };
	}
	if (/\b(wake up|mic on)\b/.test(normalizedTranscript)) {
		return { command: 'START_LISTENING' };
	}

	if (/\b(next class|next lecture)\b/.test(normalizedTranscript)) {
		return { command: 'NEXT_CLASS' };
	}
	if (/\b(is there a class|any class today|class update|do i have class)\b/.test(normalizedTranscript)) {
		return { command: 'CLASS_STATUS' };
	}
	if (/\bread (?:my )?important messages?\b|\bwhat did i miss\b|\bimportant messages?\b/.test(normalizedTranscript)) {
		return { command: 'READ_IMPORTANT' };
	}
	if (/\bread (?:my )?messages?\b|\bread whatsapp\b/.test(normalizedTranscript)) {
		return { command: 'READ_MESSAGES' };
	}
	if (/\bread (?:my )?texts?\b|\bread sms\b/.test(normalizedTranscript)) {
		return { command: 'READ_TEXTS' };
	}
	if (/\bmissed calls?\b|\bwho called\b/.test(normalizedTranscript)) {
		return { command: 'MISSED_CALLS' };
	}
	if (/\baway mode on\b|\bim away\b/.test(normalizedTranscript)) {
		return { command: 'AWAY_ON' };
	}
	if (/\baway mode off\b|\bim back\b/.test(normalizedTranscript)) {
		return { command: 'AWAY_OFF' };
	}
	if (/\b(whats the time|what time is it|tell me the time|current time|time is it)\b/.test(normalizedTranscript)) {
		return { command: 'TELL_TIME' };
	}
	if (/\b(play me something|play music|put on a song|play a song|play some music)\b/.test(normalizedTranscript)) {
		return { command: 'PLAY_MUSIC' };
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

	const teachMatch = normalizedTranscript.match(/^(?:remember that\s+(.+?)\s+is important|bubu learn\s+(.+)|learn\s+(.+))$/);
	if (teachMatch) {
		const fact = (teachMatch[1] || teachMatch[2] || teachMatch[3] || '').trim();
		if (fact) {
			return { command: 'TEACH', params: { fact } };
		}
	}

	const callMatch = normalizedTranscript.match(/^(?:call|phone|ring|dial)\s+(.+)$/);
	if (callMatch) {
		const name = callMatch[1].trim();
		// Guard against "call it off"-style false positives and empty names.
		if (name && !/^(it|that|this|them|him|her|me|back)\s+off\b/.test(name)) {
			return { command: 'CALL_CONTACT', params: { name } };
		}
	}

	return { command: 'CHAT', params: { text: transcript } };
}

module.exports = { matchCommand };
