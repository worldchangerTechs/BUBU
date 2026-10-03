const { getAllCommands, matchCommand } = require('./src/commands/registry');

console.log('Testing voice commands against registry examples...');
const commands = getAllCommands();
let total = 0;
let passed = 0;
const failures = [];

for (const cmd of commands) {
	const examples = cmd.examples || [];
	for (const example of examples) {
		total += 1;
		const res = matchCommand(example);
		const matches = res.command === cmd.id || (cmd.id === 'ASK_AI' && res.command === 'CHAT');
		if (matches) {
			passed += 1;
			console.log(`  ✓ [${cmd.id}] "${example}" -> ${res.command}`);
		} else {
			failures.push({ expected: cmd.id, example, got: res.command });
			console.error(`  ✗ [${cmd.id}] "${example}" -> got ${res.command}`);
		}
	}
}

console.log('----------------------------------------------------');
console.log(`Summary: ${passed}/${total} examples passed`);

if (failures.length > 0) {
	console.error(`${failures.length} command examples failed to resolve correctly.`);
	process.exit(1);
} else {
	console.log('All voice command examples passed!');
}
