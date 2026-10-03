const fetch = require('node-fetch');
const { BUBU_MASTER_SYSTEM_PROMPT } = require('./personality');

const COMPLETION_ENDPOINT = 'http://127.0.0.1:8090/v1/chat/completions';
let pendingRequest = null;

async function complete(prompt, systemPrompt = BUBU_MASTER_SYSTEM_PROMPT) {
	const requestFn = async () => {
		let response;
		try {
			response = await fetch(COMPLETION_ENDPOINT, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					model: 'local-model',
					messages: [
						{ role: 'system', content: String(systemPrompt || '').trim() },
						{ role: 'user', content: String(prompt || '').trim() }
					],
					max_tokens: 120,
					temperature: 0.7,
					stream: false,
					cache_prompt: true
				})
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

		const generatedText = String(
			result?.choices?.[0]?.message?.content ??
			result?.content ??
			result?.response ??
			''
		).trim();

		if (!generatedText) {
			throw new Error('Local LLM server returned no generated text.');
		}

		return generatedText;
	};

	if (pendingRequest) {
		return pendingRequest.then(() => requestFn());
	}

	pendingRequest = requestFn();
	try {
		return await pendingRequest;
	} finally {
		pendingRequest = null;
	}
}

module.exports = { complete };
