const { extractEvent } = require('./src/extractor');

const samples = [
	{
		label: 'Reschedule with room and time',
		message: 'The lecture is rescheduled to Friday at 2:30pm in Room 204.',
		expectsEvent: true
	},
	{
		label: 'Cancelled class with no new time',
		message: 'Class scheduled for Monday is cancelled; no replacement time yet.',
		expectsEvent: true
	},
	{
		label: 'No schedule content',
		message: 'The library has new study desks available.',
		expectsEvent: false
	},
	{
		label: 'Exam date announcement',
		message: 'The final exam will take place on December 12 at 9am.',
		expectsEvent: true
	},
	{
		label: 'Relative time',
		message: 'Quiz reminder: tomorrow at 5pm.',
		expectsEvent: true
	}
];

let passed = 0;

for (const sample of samples) {
	const parsed = extractEvent(sample.message);
	const passedSample = (parsed !== null) === sample.expectsEvent;

	console.log(`\n[${sample.label}]`);
	console.log(`Input: ${sample.message}`);
	console.log('Parsed result:', parsed);
	console.log(`Result: ${passedSample ? 'PASS' : 'FAIL'}`);

	if (passedSample) {
		passed += 1;
	}
}

const allPassed = passed === samples.length;
console.log(`\nSummary: ${allPassed ? 'PASS' : 'FAIL'} (${passed}/${samples.length} cases passed)`);

if (!allPassed) {
	process.exitCode = 1;
}
