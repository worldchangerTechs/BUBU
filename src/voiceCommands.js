function matchCommand(transcript) {
	if (typeof transcript !== 'string') {
		return { command: 'UNKNOWN' };
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

	if (/\b(next class|next lecture)\b/.test(normalizedTranscript)) {
		return { command: 'NEXT_CLASS' };
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

	return { command: 'UNKNOWN' };
}

module.exports = { matchCommand };
