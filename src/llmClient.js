const fetch = require('node-fetch');
const { BUBU_MASTER_SYSTEM_PROMPT } = require('./personality');

const COMPLETION_ENDPOINT = 'http://127.0.0.1:8090/completion';

async function complete(prompt, systemPrompt = BUBU_MASTER_SYSTEM_PROMPT) {
	const combinedPrompt = `${systemPrompt}\n\n${prompt}`;
	let response;

	try {
		response = await fetch(COMPLETION_ENDPOINT, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ prompt: combinedPrompt })
		});
	} catch (error) {
		throw new Error(`Local LLM server is unavailable at ${COMPLETION_ENDPOINT}: ${error.message}`);
	}

	if (!response.ok) {
		throw new Error(`Local LLM server returned HTTP ${response.status}.`);
	}

	let result;
	try {
		result = await response.json();
	} catch (error) {
		throw new Error(`Local LLM server returned invalid JSON: ${error.message}`);
	}

	const generatedText = String(result.content ?? result.response ?? '').trim();
	if (!generatedText) {
		throw new Error('Local LLM server returned no generated text.');
	}

	return generatedText;
}

module.exports = { complete };
