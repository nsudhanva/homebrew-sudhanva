// Smoke test against production. It is not part of `npm test`; run it on purpose:
//
//   node scripts/live-smoke.mjs
//
// Set SUDHANVA_API_BASE to point it at another deployment.

import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { ApiError, Client, VERSION } from '../cli/index.js';

const client = new Client({
	baseUrl: process.env.SUDHANVA_API_BASE ?? undefined,
	userAgent: 'sudhanva-js-smoke',
	timeout: 20_000,
});
const steps = [];

async function step(name, action) {
	const started = Date.now();
	await action();
	steps.push(name);
	console.log(`ok - ${name} (${Date.now() - started} ms)`);
}

await step('apiIndex', async () => {
	const index = await client.apiIndex();
	assert.equal(index.status, 'stable');
	assert.ok(index.endpoints.profile.startsWith('https://'));
});

await step('profile', async () => {
	const { profile } = await client.profile({ locale: 'en' });
	assert.equal(profile.name, 'Sudhanva Narayana');
	assert.ok(profile.knowsAbout.length > 0);
});

let firstSlug;
await step('posts with cursor pagination', async () => {
	const first = await client.posts({ limit: 2 });
	assert.equal(first.count, first.posts.length);
	assert.ok(first.total >= first.count);
	assert.ok(first.next_cursor, 'more than two posts are published');
	const second = await client.posts({ limit: 2, cursor: first.next_cursor });
	assert.notEqual(first.posts[0].slug, second.posts[0].slug);
	firstSlug = first.posts[0].slug;

	const tagged = await client.posts({ limit: 5, tag: 'kubernetes' });
	assert.ok(tagged.posts.every((post) => post.tags.includes('kubernetes')));
});

await step('allPosts', async () => {
	const { total } = await client.posts({ limit: 1 });
	let count = 0;
	for await (const post of client.allPosts({ limit: 100 })) {
		assert.ok(post.slug);
		count += 1;
	}
	assert.equal(count, total);
});

await step('post', async () => {
	const { post } = await client.post(firstSlug);
	assert.equal(post.slug, firstSlug);
});

await step('batch', async () => {
	const batch = await client.batch([
		{ id: 'profile', path: '/profile' },
		{ id: 'post', path: `/posts/${firstSlug}` },
		{ id: 'missing', path: '/posts/sdk-smoke-test-missing' },
	]);
	assert.equal(batch.count, 3);
	assert.equal(batch.results[0].status, 200);
	assert.equal(batch.results[2].status, 404);
});

await step('ask (POST and GET)', async () => {
	const answer = await client.ask('Kubernetes inference', { limit: 3 });
	assert.equal(answer._meta.response_type, 'answer');
	assert.ok(answer.results.length > 0 && answer.results.length <= 3);
	const viaGet = await client.ask('Kubernetes inference', { method: 'GET' });
	assert.equal(viaGet._meta.response_type, 'answer');
});

await step('profile insight job to completion, with idempotent replay', async () => {
	const key = `sudhanva-js-smoke-${Date.now()}`;
	const request = { audience: 'agent', focus: ['inference'] };
	const job = await client.createProfileInsight(request, key);
	assert.match(job.job_id, /^pi_[0-9a-f]{32}$/);
	const replay = await client.createProfileInsight(request, key);
	assert.equal(replay.job_id, job.job_id);
	const done = await client.waitForProfileInsight(job.job_id, {
		pollInterval: 500,
		timeout: 30_000,
	});
	assert.equal(done.status, 'succeeded');
	assert.equal(done.result.audience, 'agent');
	assert.ok(done.result.summary.length > 0);
	console.log(`     ${done.job_id}: ${done.result.title}`);
});

await step('404 decodes as ApiError (envelope)', async () => {
	const error = await client.post('sdk-smoke-test-missing').catch((caught) => caught);
	assert.ok(error instanceof ApiError, String(error));
	assert.equal(error.status, 404);
	assert.equal(error.code, 'POST_NOT_FOUND');
	assert.ok(error.hint);
	assert.ok(error.docsUrl);
	const job = await client
		.profileInsight('pi_00000000000000000000000000000000')
		.catch((caught) => caught);
	assert.equal(job.code, 'PROFILE_INSIGHT_NOT_FOUND');
});

await step('422 decodes as ApiError (problem+json)', async () => {
	const error = await client
		.createProfileInsight({ audience: 'nobody' }, `sudhanva-js-invalid-${Date.now()}`)
		.catch((caught) => caught);
	assert.ok(error instanceof ApiError, String(error));
	assert.equal(error.status, 422);
	assert.equal(error.code, 'INVALID_PROFILE_INSIGHT');
	assert.match(error.contentType, /^application\/problem\+json/);
	assert.ok(error.detail && error.title && error.instance);
});

await step('CLI against production', async () => {
	const run = promisify(execFile);
	const cli = new URL('../cli/sudhanva.mjs', import.meta.url).pathname;
	const { stdout } = await run(process.execPath, [cli, 'post', firstSlug, '--compact']);
	assert.equal(JSON.parse(stdout).post.slug, firstSlug);
	const failure = await run(process.execPath, [cli, 'post', 'sdk-smoke-test-missing']).catch(
		(error) => error,
	);
	assert.equal(failure.code, 1);
	assert.match(failure.stderr, /^sudhanva\.me API error: /);
});

console.log(`\nsudhanva ${VERSION}: ${steps.length} live checks passed on ${process.version}.`);
