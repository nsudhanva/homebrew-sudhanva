import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';

import { commandUrl, parseArguments, run, VERSION } from '../cli/sudhanva.mjs';

const execFileAsync = promisify(execFile);

test('distribution metadata matches the CLI version and MIT license', async () => {
	const packageMetadata = JSON.parse(
		await readFile(new URL('../cli/package.json', import.meta.url), 'utf8'),
	);
	const packageLicense = await readFile(new URL('../cli/LICENSE', import.meta.url), 'utf8');
	const repositoryLicense = await readFile(new URL('../LICENSE', import.meta.url), 'utf8');
	assert.equal(packageMetadata.name, 'sudhanva');
	assert.equal(packageMetadata.version, VERSION);
	assert.equal(packageMetadata.license, 'MIT');
	assert.equal(packageLicense, repositoryLicense);
});

test('CLI executes through package-manager-style symbolic links', async () => {
	const directory = await mkdtemp(join(tmpdir(), 'sudhanva-cli-test-'));
	const executable = join(directory, 'sudhanva');
	await symlink(new URL('../cli/sudhanva.mjs', import.meta.url), executable);
	const { stdout } = await execFileAsync(process.execPath, [executable, '--version']);
	assert.equal(stdout.trim(), VERSION);
});

test('CLI parses commands into canonical versioned API URLs', () => {
	const options = parseArguments(['posts', '--limit', '5', '--tag', 'kubernetes', '--compact']);
	assert.equal(options.command, 'posts');
	assert.equal(options.compact, true);
	assert.equal(
		commandUrl(options).toString(),
		'https://sudhanva.me/api/v1/posts?limit=5&tag=kubernetes',
	);
	assert.equal(
		commandUrl(parseArguments(['post', 'example-post'])).pathname,
		'/api/v1/posts/example-post',
	);
	assert.equal(
		commandUrl(parseArguments(['insight', '--audience', 'recruiter'])).pathname,
		'/api/v1/profile-insights',
	);
});

test('CLI rejects unsafe or unsupported arguments before making a request', () => {
	assert.throws(() => parseArguments(['posts', '--limit', '0']), /1 through 100/);
	assert.throws(() => parseArguments(['post', '../secret']), /Post slugs/);
	assert.throws(() => parseArguments(['profile', '--locale', 'fr']), /Only locale en/);
	assert.throws(() => parseArguments(['insight']), /requires --audience/);
	assert.throws(() => parseArguments(['insight', '--audience', 'robot']), /--audience must/);
});

test('CLI creates and polls an idempotent profile-insight job', async () => {
	const requests = [];
	let output = '';
	const responses = [
		new Response(
			JSON.stringify({
				job_id: 'pi_0123456789abcdef0123456789abcdef',
				status: 'queued',
				status_url:
					'https://sudhanva.me/api/v1/profile-insights/pi_0123456789abcdef0123456789abcdef',
			}),
			{ status: 202, headers: { 'Content-Type': 'application/json', 'Retry-After': '1' } },
		),
		Response.json({
			job_id: 'pi_0123456789abcdef0123456789abcdef',
			status: 'succeeded',
			status_url: 'https://sudhanva.me/api/v1/profile-insights/pi_0123456789abcdef0123456789abcdef',
			result: { title: 'For a recruiter' },
		}),
	];
	const status = await run(
		[
			'insight',
			'--audience',
			'recruiter',
			'--focus',
			'production-ml,kubernetes',
			'--idempotency-key',
			'cli-test-key-001',
			'--wait',
			'--compact',
		],
		{
			fetchImpl: async (url, options) => {
				requests.push({ url: url.toString(), options });
				return responses.shift();
			},
			sleep: async () => {},
			stdout: (text) => {
				output += text;
			},
		},
	);
	assert.equal(status, 0);
	assert.equal(requests.length, 2);
	assert.equal(requests[0].options.method, 'POST');
	assert.equal(requests[0].options.headers['Idempotency-Key'], 'cli-test-key-001');
	assert.deepEqual(JSON.parse(requests[0].options.body), {
		audience: 'recruiter',
		focus: ['production-ml', 'kubernetes'],
	});
	assert.equal(JSON.parse(output).status, 'succeeded');
});

test('CLI emits structured JSON from the public API contract', async () => {
	let requested;
	let output = '';
	const status = await run(['profile', '--compact'], {
		fetchImpl: async (url, options) => {
			requested = { url: url.toString(), options };
			return Response.json({ profile: { name: 'Sudhanva Narayana' } });
		},
		stdout: (text) => {
			output += text;
		},
	});
	assert.equal(status, 0);
	assert.equal(requested.url, 'https://sudhanva.me/api/v1/profile');
	assert.equal(requested.options.headers['User-Agent'], `sudhanva-cli/${VERSION}`);
	assert.deepEqual(JSON.parse(output), {
		profile: { name: 'Sudhanva Narayana' },
	});
});

test('CLI surfaces structured API failures as errors', async () => {
	await assert.rejects(
		run(['post', 'missing-post'], {
			fetchImpl: async () =>
				Response.json({ error: { message: 'No published post exists.' } }, { status: 404 }),
			stdout: () => {},
		}),
		/No published post exists/,
	);
});
