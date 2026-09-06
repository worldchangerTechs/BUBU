const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const FormData = require('form-data');
const fetch = require('node-fetch');

const samplePath = path.join(os.homedir(), 'voice_sample.wav');
const endpoint = 'https://api.elevenlabs.io/v1/voices/add';

async function readApiError(response) {
	const body = await response.text();
	try {
		const parsed = JSON.parse(body);
		return parsed.detail?.message || parsed.detail || parsed.message || body;
	} catch {
		return body;
	}
}

async function enrollVoice() {
	const apiKey = process.env.ELEVENLABS_API_KEY;
	if (!apiKey) {
		throw new Error('ELEVENLABS_API_KEY is not set. Export it before running this script.');
	}

	if (!fs.existsSync(samplePath)) {
		throw new Error(`Voice sample not found at ${samplePath}. Run node scripts/record-voice-sample.js first.`);
	}

	const form = new FormData();
	form.append('name', 'BUBU-owner-voice');
	form.append('files', fs.createReadStream(samplePath));

	const response = await fetch(endpoint, {
		method: 'POST',
		headers: {
			'xi-api-key': apiKey,
			...form.getHeaders()
		},
		body: form
	});

	if (!response.ok) {
		throw new Error(await readApiError(response));
	}

	const result = await response.json();
	if (!result.voice_id) {
		throw new Error(`ElevenLabs response did not include voice_id: ${JSON.stringify(result)}`);
	}

	console.log(`Voice enrolled successfully. voice_id: ${result.voice_id}`);
	console.log(`Copy this into .env: ELEVENLABS_VOICE_ID=${result.voice_id}`);
}

enrollVoice().catch((error) => {
	console.error(`Voice enrollment failed: ${error.message}`);
	process.exitCode = 1;
});