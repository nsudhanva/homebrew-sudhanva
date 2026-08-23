#!/usr/bin/env node

import process from 'node:process';
import { randomUUID } from 'node:crypto';
import { realpathSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath, URL } from 'node:url';

export const VERSION = '0.1.5';
export const DEFAULT_API_BASE = 'https://sudhanva.me/api/v1';

const HELP = `sudhanva ${VERSION}

Read Sudhanva Narayana's public data or create a temporary profile insight.

Usage:
  sudhanva api [--locale en] [--compact]
  sudhanva profile [--locale en] [--compact]
  sudhanva posts [--limit 1-100] [--tag TAG] [--cursor CURSOR] [--locale en] [--compact]
  sudhanva post SLUG [--locale en] [--compact]
  sudhanva insight --audience AUDIENCE [--focus FOCUS,...] [--idempotency-key KEY] [--wait] [--compact]
  sudhanva --help
  sudhanva --version

The CLI prints structured JSON to stdout. Insight jobs expire after 24 hours.`;

const AUDIENCES = new Set(['recruiter', 'hiring-manager', 'collaborator', 'researcher', 'agent']);
const FOCUS_AREAS = new Set([
	'production-ml',
	'ml-infrastructure',
	'inference',
	'kubernetes',
	'distributed-systems',
	'technical-writing',
	'career',
]);

function fail(message) {
	throw new Error(message);
}

export function parseArguments(argv) {
	const tokens = [...argv];
	if (tokens.length === 0 || tokens.includes('--help') || tokens.includes('-h')) {
		return { command: 'help', compact: false };
	}
	if (tokens.includes('--version') || tokens.includes('-v')) {
		return { command: 'version', compact: false };
	}

	const command = tokens.shift();
	if (!['api', 'profile', 'posts', 'post', 'insight'].includes(command)) {
		fail(`Unknown command: ${command}. Run sudhanva --help.`);
	}

	const result = { command, compact: false };
	if (command === 'post') {
		const slug = tokens.shift();
		if (!slug || slug.startsWith('-')) fail('The post command requires a canonical slug.');
		if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
			fail('Post slugs must contain lowercase letters, numbers, and single hyphens.');
		}
		result.slug = slug;
	}

	while (tokens.length > 0) {
		const option = tokens.shift();
		if (option === '--compact') {
			result.compact = true;
			continue;
		}
		if (option === '--wait') {
			result.wait = true;
			continue;
		}
		if (
			![
				'--limit',
				'--tag',
				'--cursor',
				'--locale',
				'--audience',
				'--focus',
				'--idempotency-key',
			].includes(option)
		) {
			fail(`Unknown option: ${option}. Run sudhanva --help.`);
		}
		const value = tokens.shift();
		if (!value || value.startsWith('--')) fail(`${option} requires a value.`);
		const key = option.slice(2);
		result[key] = value;
	}

	if (result.locale && result.locale !== 'en') fail('Only locale en is currently supported.');
	if (result.limit) {
		if (!/^\d+$/.test(result.limit)) fail('--limit must be an integer from 1 through 100.');
		const limit = Number.parseInt(result.limit, 10);
		if (limit < 1 || limit > 100) fail('--limit must be an integer from 1 through 100.');
	}
	if (command !== 'posts' && (result.limit || result.tag || result.cursor)) {
		fail('--limit, --tag, and --cursor are supported only by the posts command.');
	}
	if (result.tag && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(result.tag)) {
		fail('--tag must contain lowercase letters, numbers, and single hyphens.');
	}
	if (
		command !== 'insight' &&
		(result.audience || result.focus || result['idempotency-key'] || result.wait)
	) {
		fail('--audience, --focus, --idempotency-key, and --wait are supported only by insight.');
	}
	if (command === 'insight') {
		if (!result.audience) fail('The insight command requires --audience.');
		if (!AUDIENCES.has(result.audience)) {
			fail('--audience must be recruiter, hiring-manager, collaborator, researcher, or agent.');
		}
		if (result.focus) {
			const areas = result.focus.split(',').filter(Boolean);
			if (areas.length === 0 || areas.length > 5 || new Set(areas).size !== areas.length) {
				fail('--focus must contain one to five unique comma-separated values.');
			}
			if (areas.some((area) => !FOCUS_AREAS.has(area))) {
				fail('--focus contains an unsupported value. Run sudhanva --help.');
			}
			result.focus = areas;
		}
		const key = result['idempotency-key'];
		if (key && (key.length < 8 || key.length > 128 || !/^[A-Za-z0-9._:-]+$/.test(key))) {
			fail(
				'--idempotency-key must be 8 to 128 letters, numbers, periods, underscores, colons, or hyphens.',
			);
		}
	}

	return result;
}

export function commandUrl(options, apiBase = DEFAULT_API_BASE) {
	const base = apiBase.replace(/\/+$/, '');
	let path = '';
	if (options.command === 'profile') path = '/profile';
	if (options.command === 'posts') path = '/posts';
	if (options.command === 'post') path = `/posts/${encodeURIComponent(options.slug)}`;
	if (options.command === 'insight') path = '/profile-insights';
	const url = new URL(`${base}${path}`);
	for (const key of ['limit', 'tag', 'cursor', 'locale']) {
		if (options[key]) url.searchParams.set(key, options[key]);
	}
	return url;
}

export async function run(
	argv,
	{
		fetchImpl = globalThis.fetch,
		stdout = (text) => process.stdout.write(text),
		apiBase = process.env.SUDHANVA_API_BASE ?? DEFAULT_API_BASE,
		sleep = (milliseconds) => delay(milliseconds),
	} = {},
) {
	const options = parseArguments(argv);
	if (options.command === 'help') {
		stdout(`${HELP}\n`);
		return 0;
	}
	if (options.command === 'version') {
		stdout(`${VERSION}\n`);
		return 0;
	}

	const url = commandUrl(options, apiBase);
	const requestOptions = {
		headers: {
			Accept: 'application/json',
			'User-Agent': `sudhanva-cli/${VERSION}`,
		},
	};
	if (options.command === 'insight') {
		requestOptions.method = 'POST';
		requestOptions.headers['Content-Type'] = 'application/json';
		requestOptions.headers['Idempotency-Key'] = options['idempotency-key'] ?? `cli-${randomUUID()}`;
		requestOptions.body = JSON.stringify({
			audience: options.audience,
			...(options.focus ? { focus: options.focus } : {}),
		});
	}
	let response = await fetchImpl(url, requestOptions);
	let text = await response.text();
	let payload;
	try {
		payload = JSON.parse(text);
	} catch {
		fail(`The API returned non-JSON content with HTTP ${response.status}.`);
	}
	if (!response.ok) {
		const detail = payload?.error?.message ?? payload?.detail ?? `HTTP ${response.status}`;
		fail(`sudhanva.me API error: ${detail}`);
	}

	if (options.command === 'insight' && options.wait) {
		for (let attempt = 0; !['succeeded', 'failed'].includes(payload.status); attempt += 1) {
			if (attempt >= 30) fail('The insight job did not finish within the polling limit.');
			const seconds = Number.parseInt(response.headers.get('Retry-After') ?? '1', 10);
			await sleep(Number.isFinite(seconds) ? Math.max(seconds, 1) * 1000 : 1000);
			response = await fetchImpl(payload.status_url, {
				headers: requestOptions.headers,
			});
			text = await response.text();
			try {
				payload = JSON.parse(text);
			} catch {
				fail(`The API returned non-JSON content with HTTP ${response.status}.`);
			}
			if (!response.ok) {
				fail(
					`sudhanva.me API error: ${payload?.error?.message ?? payload?.detail ?? `HTTP ${response.status}`}`,
				);
			}
		}
		if (payload.status === 'failed')
			fail(`Profile insight failed: ${payload.error?.detail ?? 'unknown error'}`);
	}

	stdout(`${JSON.stringify(payload, null, options.compact ? 0 : 2)}\n`);
	return 0;
}

const isDirect =
	process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
if (isDirect) {
	run(process.argv.slice(2)).catch((error) => {
		process.stderr.write(`${error.message}\n`);
		process.exitCode = 1;
	});
}
