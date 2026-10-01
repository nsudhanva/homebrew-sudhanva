import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, readFile, symlink } from 'node:fs/promises';
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
	assert.equal(
		requested.options.headers['User-Agent'],
		`sudhanva-js/${VERSION} sudhanva-cli/${VERSION}`,
	);
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

test('CLI reports the failure message of a failed insight job', async () => {
	const responses = [
		Response.json(
			{ job_id: 'pi_0123456789abcdef0123456789abcdef', status: 'queued' },
			{ status: 202, headers: { 'Retry-After': '3' } },
		),
		Response.json({
			job_id: 'pi_0123456789abcdef0123456789abcdef',
			status: 'failed',
			error: { code: 'INSIGHT_FAILED', message: 'Published data was unavailable.' },
		}),
	];
	const sleeps = [];
	const requests = [];
	await assert.rejects(
		run(['insight', '--audience', 'agent', '--wait'], {
			fetchImpl: async (url, options) => {
				requests.push({ url: url.toString(), options });
				return responses.shift();
			},
			sleep: async (milliseconds) => {
				sleeps.push(milliseconds);
			},
			stdout: () => {},
		}),
		/^Error: Profile insight failed: Published data was unavailable\.$/,
	);
	assert.deepEqual(sleeps, [3000], 'Retry-After from the create response sets the poll delay');
	assert.equal(
		requests[1].url,
		'https://sudhanva.me/api/v1/profile-insights/pi_0123456789abcdef0123456789abcdef',
	);
	assert.match(requests[0].options.headers['Idempotency-Key'], /^cli-[0-9a-f-]{36}$/);
});

test('CLI stops polling after 30 attempts', async () => {
	let calls = 0;
	await assert.rejects(
		run(['insight', '--audience', 'agent', '--wait'], {
			fetchImpl: async () => {
				calls += 1;
				return Response.json({ job_id: 'pi_0123456789abcdef0123456789abcdef', status: 'running' });
			},
			sleep: async () => {},
			stdout: () => {},
		}),
		/did not finish within the polling limit/,
	);
	assert.equal(calls, 31);
});

test('CLI prints the job without polling when --wait is absent', async () => {
	let output = '';
	let calls = 0;
	await run(['insight', '--audience', 'researcher', '--focus', 'inference'], {
		fetchImpl: async () => {
			calls += 1;
			return Response.json({ job_id: 'pi_0123456789abcdef0123456789abcdef', status: 'queued' });
		},
		stdout: (text) => {
			output += text;
		},
	});
	assert.equal(calls, 1);
	assert.equal(JSON.parse(output).status, 'queued');
	assert.match(output, /^{\n {2}"job_id"/, 'output is pretty-printed by default');
});

test('CLI maps every read command to the same URLs as before', async () => {
	const seen = [];
	const fetchImpl = async (url) => {
		seen.push(url.toString());
		return Response.json({});
	};
	const options = { fetchImpl, stdout: () => {}, apiBase: 'http://localhost:8787/api/v1/' };
	await run(['api', '--locale', 'en'], options);
	await run(['profile'], options);
	await run(['posts'], options);
	await run(['posts', '--limit', '5', '--tag', 'kubernetes', '--cursor', 'c2'], options);
	await run(['post', 'example-post', '--locale', 'en'], options);
	assert.deepEqual(seen, [
		'http://localhost:8787/api/v1?locale=en',
		'http://localhost:8787/api/v1/profile',
		'http://localhost:8787/api/v1/posts',
		'http://localhost:8787/api/v1/posts?limit=5&tag=kubernetes&cursor=c2',
		'http://localhost:8787/api/v1/posts/example-post?locale=en',
	]);
	const legacy = [['api'], ['profile'], ['posts'], null, ['post', 'example-post']];
	for (const [index, argv] of legacy.entries()) {
		if (!argv) continue;
		assert.equal(seen[index].split('?')[0], commandUrl(parseArguments(argv), options.apiBase).href);
	}
});

test('CLI reports problem+json details and non-JSON responses', async () => {
	await assert.rejects(
		run(['insight', '--audience', 'agent'], {
			fetchImpl: async () =>
				new Response(
					JSON.stringify({
						type: 'https://sudhanva.me/docs/profile-insights/#idempotency-key',
						title: 'Idempotency key conflict',
						status: 422,
						detail: 'The key was used with a different request.',
						instance: '/api/v1/profile-insights',
					}),
					{ status: 422, headers: { 'Content-Type': 'application/problem+json' } },
				),
			stdout: () => {},
		}),
		/^Error: sudhanva.me API error: The key was used with a different request\.$/,
	);
	for (const status of [200, 502]) {
		await assert.rejects(
			run(['profile'], {
				fetchImpl: async () => new Response('<html></html>', { status }),
				stdout: () => {},
			}),
			new RegExp(`^Error: The API returned non-JSON content with HTTP ${status}\\.$`),
		);
	}
	await assert.rejects(
		run(['profile'], {
			fetchImpl: async () => Response.json([], { status: 500 }),
			stdout: () => {},
		}),
		/^Error: sudhanva.me API error: HTTP 500$/,
	);
});

test('CLI exits 1 with the message on stderr and 0 on success', async () => {
	const cli = new URL('../cli/sudhanva.mjs', import.meta.url);
	const failure = await execFileAsync(process.execPath, [
		cli.pathname,
		'posts',
		'--limit',
		'0',
	]).catch((error) => error);
	assert.equal(failure.code, 1);
	assert.equal(failure.stdout, '');
	assert.equal(failure.stderr, '--limit must be an integer from 1 through 100.\n');
	const help = await execFileAsync(process.execPath, [cli.pathname, '--help']);
	assert.match(help.stdout, /^sudhanva 0\.2\.0\n/);
	assert.match(help.stdout, /Insight jobs expire after 24 hours\.\n$/);
});

test('CLI runs from an extracted package through an extensionless symbolic link', async () => {
	const directory = await mkdtemp(join(tmpdir(), 'sudhanva-cli-link-'));
	const packageDirectory = join(directory, 'lib', 'sudhanva');
	await mkdir(join(directory, 'bin'), { recursive: true });
	await mkdir(packageDirectory, { recursive: true });
	for (const file of ['index.js', 'sudhanva.mjs', 'package.json']) {
		await copyFile(new URL(`../cli/${file}`, import.meta.url), join(packageDirectory, file));
	}
	const executable = join(directory, 'bin', 'sudhanva');
	await symlink(join(packageDirectory, 'sudhanva.mjs'), executable);
	const { stdout } = await execFileAsync(process.execPath, [executable, '--version']);
	assert.equal(stdout.trim(), VERSION);
});
