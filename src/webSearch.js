const fetch = require('node-fetch');
const cheerio = require('cheerio');

const SEARCH_ENDPOINT = 'https://html.duckduckgo.com/html/';
const FETCH_TIMEOUT_MS = 5000;
const USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

function resultUrl(href) {
	try {
		const url = new URL(href, SEARCH_ENDPOINT);
		const redirectedUrl = url.searchParams.get('uddg');
		return redirectedUrl || url.toString();
	} catch {
		return href;
	}
}

async function search(query) {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

	try {
		const url = `${SEARCH_ENDPOINT}?q=${encodeURIComponent(String(query ?? ''))}`;
		const response = await fetch(url, {
			headers: { 'User-Agent': USER_AGENT },
			signal: controller.signal
		});
		if (!response.ok) {
			return [];
		}

		const html = await response.text();
		const $ = cheerio.load(html);
		return $('.result')
			.map((index, element) => {
				const link = $(element).find('.result__a').first();
				const title = link.text().trim();
				const snippet = $(element).find('.result__snippet').first().text().trim();
				const href = link.attr('href');
				return title && snippet && href
					? { title, snippet, url: resultUrl(href) }
					: null;
			})
			.get()
			.slice(0, 5);
	} catch {
		return [];
	} finally {
		clearTimeout(timeout);
	}
}

module.exports = { search };