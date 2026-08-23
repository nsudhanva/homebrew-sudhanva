#!/usr/bin/env node

import process from 'node:process';
import { realpathSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';

export const VERSION = '0.1.2';
export const DEFAULT_API_BASE = 'https://sudhanva.me/api/v1';

const HELP = `sudhanva ${VERSION}

Read Sudhanva Narayana's public profile and writing metadata.

Usage:
  sudhanva api [--locale en] [--compact]
  sudhanva profile [--locale en] [--compact]
  sudhanva posts [--limit 1-100] [--tag TAG] [--cursor CURSOR] [--locale en] [--compact]
  sudhanva post SLUG [--locale en] [--compact]
  sudhanva --help
  sudhanva --version

The CLI performs read-only HTTPS GET requests and prints JSON to stdout.`;

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
	if (!['api', 'profile', 'posts', 'post'].includes(command)) {
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
		if (!['--limit', '--tag', '--cursor', '--locale'].includes(option)) {
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

	return result;
}

export function commandUrl(options, apiBase = DEFAULT_API_BASE) {
	const base = apiBase.replace(/\/+$/, '');
	let path = '';
	if (options.command === 'profile') path = '/profile';
	if (options.command === 'posts') path = '/posts';
	if (options.command === 'post') path = `/posts/${encodeURIComponent(options.slug)}`;
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
	const response = await fetchImpl(url, {
		headers: {
			Accept: 'application/json',
			'User-Agent': `sudhanva-cli/${VERSION}`,
		},
	});
	const text = await response.text();
	let payload;
	try {
		payload = JSON.parse(text);
	} catch {
		fail(`The API returned non-JSON content with HTTP ${response.status}.`);
	}
	if (!response.ok) {
		const detail = payload?.error?.message ?? `HTTP ${response.status}`;
		fail(`sudhanva.me API error: ${detail}`);
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
