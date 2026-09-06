const { matchCommand } = require('./src/voiceCommands');

const phrases = [
	"What's my next class?",
	'Read WhatsApp',
	'Please read my texts',
	'Who called while I was away?',
	"I'm away now",
	"I'm back home",
	'Text {name} saying the meeting moved to tomorrow',
	'Tell me a random joke'
];

for (const phrase of phrases) {
	const result = matchCommand(phrase);
	const params = result.params ? ` ${JSON.stringify(result.params)}` : '';

	console.log(`${phrase} -> ${result.command}${params}`);
}
