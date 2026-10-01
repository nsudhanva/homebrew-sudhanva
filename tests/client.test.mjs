import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
	ApiError,
	Client,
	DEFAULT_BASE_URL,
	ProfileInsightTimeoutError,
	USER_AGENT,
	VERSION,
} from '../cli/index.js';

const JOB_ID = 'pi_0123456789abcdef0123456789abcdef';

/** A fetch mock that records requests and replays queued responses. */
function mockFetch(...responses) {
	const requests = [];
	const fetch = async (url, init = {}) => {
		requests.push({ url: new URL(url), init, body: init.body ? JSON.parse(init.body) : undefined });
		const next = responses.length > 1 ? responses.shift() : responses[0];
		return typeof next === 'function' ? next(url, init) : next.clone();
	};
	return { fetch, requests };
}

function json(body, status = 200, headers = {}) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers },
	});
}

function job(status, extra = {}) {
	return {
		job_id: JOB_ID,
		status,
		status_url: `https://sudhanva.me/api/v1/profile-insights/${JOB_ID}`,
		created_at: '2026-10-01T00:00:00Z',
		updated_at: '2026-10-01T00:00:00Z',
		expires_at: '2026-10-02T00:00:00Z',
		...extra,
	};
}

test('VERSION matches package.json and the User-Agent token', async () => {
	const metadata = JSON.parse(await readFile(new URL('../cli/package.json', import.meta.url)));
	assert.equal(VERSION, metadata.version);
	assert.equal(VERSION, '0.2.0');
	assert.equal(USER_AGENT, `sudhanva-js/${VERSION}`);
	assert.equal(DEFAULT_BASE_URL, 'https://sudhanva.me/api/v1');
});

test('constructor normalizes the base URL and validates options', () => {
	const client = new Client({ baseUrl: 'http://localhost:8787/api/v1///?x=1#y', fetch: () => {} });
	assert.equal(client.baseUrl, 'http://localhost:8787/api/v1');
	assert.equal(client.siteUrl, 'http://localhost:8787');
	assert.equal(new Client().baseUrl, DEFAULT_BASE_URL);
	assert.throws(() => new Client({ baseUrl: 'not a url' }), TypeError);
	assert.throws(() => new Client({ baseUrl: 'ftp://example.com' }), /HTTP or HTTPS/);
	assert.throws(() => new Client({ timeout: 0 }), /timeout/);
	assert.throws(() => new Client({ timeout: -1 }), /timeout/);
});

test('profile sends Accept and User-Agent and returns decoded JSON', async () => {
	const { fetch, requests } = mockFetch(json({ profile: { name: 'Sudhanva Narayana' } }));
	const client = new Client({ fetch });
	const result = await client.profile();
	assert.equal(result.profile.name, 'Sudhanva Narayana');
	const [request] = requests;
	assert.equal(request.url.href, 'https://sudhanva.me/api/v1/profile');
	assert.equal(request.init.method, 'GET');
	assert.equal(request.init.headers.Accept, 'application/json');
	assert.equal(request.init.headers['User-Agent'], `sudhanva-js/${VERSION}`);
	assert.equal(request.init.headers['Content-Type'], undefined);
	assert.equal(request.init.body, undefined);
	assert.ok(request.init.signal instanceof AbortSignal);

	await client.profile({ locale: 'en' });
	assert.equal(requests[1].url.search, '?locale=en');
});

test('userAgent appends a product token', async () => {
	const { fetch, requests } = mockFetch(json({}));
	await new Client({ fetch, userAgent: 'my-app/1.0' }).profile();
	assert.equal(requests[0].init.headers['User-Agent'], `sudhanva-js/${VERSION} my-app/1.0`);
});

test('apiIndex reads the API root', async () => {
	const { fetch, requests } = mockFetch(json({ name: 'sudhanva.me Public API' }));
	await new Client({ fetch }).apiIndex({ locale: 'en' });
	assert.equal(requests[0].url.href, 'https://sudhanva.me/api/v1?locale=en');
});

test('posts sends only the filters given and validates limit', async () => {
	const { fetch, requests } = mockFetch(json({ count: 0, total: 0, next_cursor: null, posts: [] }));
	const client = new Client({ fetch });
	await client.posts();
	assert.equal(requests[0].url.href, 'https://sudhanva.me/api/v1/posts');
	await client.posts({ limit: 5, tag: 'kubernetes', cursor: 'abc', locale: 'en' });
	assert.deepEqual(Object.fromEntries(requests[1].url.searchParams), {
		limit: '5',
		tag: 'kubernetes',
		cursor: 'abc',
		locale: 'en',
	});
	for (const limit of [0, 101, 1.5, '5']) {
		assert.throws(() => client.posts({ limit }), /limit must be an integer from 1 through 100/);
	}
	assert.equal(requests.length, 2);
});

test('allPosts follows next_cursor across pages', async () => {
	const { fetch, requests } = mockFetch(
		json({ count: 2, total: 3, next_cursor: 'page-2', posts: [{ slug: 'a' }, { slug: 'b' }] }),
		json({ count: 1, total: 3, next_cursor: null, posts: [{ slug: 'c' }] }),
	);
	const slugs = [];
	for await (const post of new Client({ fetch }).allPosts({ limit: 2, tag: 'ml' })) {
		slugs.push(post.slug);
	}
	assert.deepEqual(slugs, ['a', 'b', 'c']);
	assert.equal(requests[0].url.searchParams.get('cursor'), null);
	assert.equal(requests[1].url.searchParams.get('cursor'), 'page-2');
	assert.equal(requests[1].url.searchParams.get('tag'), 'ml');
});

test('post encodes the slug as one path segment', async () => {
	const { fetch, requests } = mockFetch(json({ post: { slug: 'x' } }));
	const client = new Client({ fetch });
	await client.post('making-your-site-agent-friendly');
	assert.equal(requests[0].url.pathname, '/api/v1/posts/making-your-site-agent-friendly');
	await client.post('../secret?x');
	assert.equal(requests[1].url.pathname, '/api/v1/posts/..%2Fsecret%3Fx');
	assert.throws(() => client.post(''), /slug is required/);
});

test('batch posts operations, defaults method to GET, and enforces 1 to 20 items', async () => {
	const { fetch, requests } = mockFetch(json({ count: 2, results: [] }));
	const client = new Client({ fetch });
	await client.batch([
		{ id: 'profile', path: '/profile' },
		{ id: 'latest', method: 'GET', path: '/posts?limit=3' },
	]);
	const [request] = requests;
	assert.equal(request.url.href, 'https://sudhanva.me/api/v1/batch');
	assert.equal(request.init.method, 'POST');
	assert.equal(request.init.headers['Content-Type'], 'application/json');
	assert.deepEqual(request.body, {
		operations: [
			{ id: 'profile', method: 'GET', path: '/profile' },
			{ id: 'latest', method: 'GET', path: '/posts?limit=3' },
		],
	});
	assert.throws(() => client.batch([]), /between 1 and 20/);
	const many = Array.from({ length: 21 }, (_, index) => ({ id: `${index}`, path: '/profile' }));
	assert.throws(() => client.batch(many), /between 1 and 20/);
	await client.batch(many.slice(0, 20));
	assert.equal(requests[1].body.operations.length, 20);
});

test('ask sends an NLWeb 0.55 POST to the site origin', async () => {
	const { fetch, requests } = mockFetch(json({ _meta: { response_type: 'answer' }, results: [] }));
	const client = new Client({ fetch, baseUrl: 'http://localhost:8787/api/v1' });
	await client.ask('Kubernetes inference', { limit: 3, mode: 'summarize' });
	assert.equal(requests[0].url.href, 'http://localhost:8787/ask');
	assert.equal(requests[0].init.method, 'POST');
	assert.deepEqual(requests[0].body, {
		query: { text: 'Kubernetes inference', site: 'http://localhost:8787', limit: 3 },
		prefer: { streaming: false, response_format: 'conversational_search', mode: 'summarize' },
		meta: { version: '0.55' },
	});
	await client.ask('defaults');
	assert.equal(requests[1].body.query.limit, 10);
	assert.equal(requests[1].body.prefer.mode, 'list');
});

test('ask supports the GET form with only the query', async () => {
	const { fetch, requests } = mockFetch(json({ _meta: { response_type: 'answer' }, results: [] }));
	const client = new Client({ fetch });
	await client.ask('vector search & milvus', { method: 'GET' });
	assert.equal(requests[0].init.method, 'GET');
	assert.equal(requests[0].url.origin + requests[0].url.pathname, 'https://sudhanva.me/ask');
	assert.equal(requests[0].url.searchParams.get('query'), 'vector search & milvus');
	assert.equal(requests[0].init.body, undefined);
	assert.throws(() => client.ask('x', { method: 'GET', limit: 2 }), /require method POST/);
	assert.throws(() => client.ask('x', { method: 'PUT' }), /GET or POST/);
	assert.throws(() => client.ask(''), /text is required/);
	assert.throws(() => client.ask('x', { limit: 21 }), /1 through 20/);
});

test('createProfileInsight sends the Idempotency-Key header and JSON body', async () => {
	const { fetch, requests } = mockFetch(json(job('queued'), 202, { 'Retry-After': '1' }));
	const client = new Client({ fetch });
	const created = await client.createProfileInsight(
		{ audience: 'hiring-manager', focus: ['production-ml', 'inference'] },
		'my-workflow-2026-10-01',
	);
	assert.equal(created.job_id, JOB_ID);
	const [request] = requests;
	assert.equal(request.url.href, 'https://sudhanva.me/api/v1/profile-insights');
	assert.equal(request.init.method, 'POST');
	assert.equal(request.init.headers['Idempotency-Key'], 'my-workflow-2026-10-01');
	assert.equal(request.init.headers['Content-Type'], 'application/json');
	assert.equal(request.init.headers.Accept, 'application/json');
	assert.deepEqual(request.body, {
		audience: 'hiring-manager',
		focus: ['production-ml', 'inference'],
	});

	await client.createProfileInsight({ audience: 'agent' }, 'key-without-focus');
	assert.deepEqual(requests[1].body, { audience: 'agent' });
	assert.throws(() => client.createProfileInsight({ audience: 'agent' }), /idempotencyKey/);
	assert.throws(() => client.createProfileInsight({}, 'abcdefgh'), /audience/);
});

test('profileInsight reads one job', async () => {
	const { fetch, requests } = mockFetch(json(job('running')));
	const result = await new Client({ fetch }).profileInsight(JOB_ID);
	assert.equal(result.status, 'running');
	assert.equal(requests[0].url.pathname, `/api/v1/profile-insights/${JOB_ID}`);
	assert.throws(() => new Client({ fetch }).profileInsight(''), /jobId is required/);
});

test('waitForProfileInsight polls until a terminal state', async () => {
	const { fetch, requests } = mockFetch(
		json(job('queued')),
		json(job('running')),
		json(job('succeeded', { result: { title: 'For an agent' } })),
	);
	const done = await new Client({ fetch }).waitForProfileInsight(JOB_ID, { pollInterval: 0 });
	assert.equal(done.status, 'succeeded');
	assert.equal(done.result.title, 'For an agent');
	assert.equal(requests.length, 3);
});

test('waitForProfileInsight returns failed jobs instead of throwing', async () => {
	const { fetch } = mockFetch(json(job('failed', { error: { code: 'X', message: 'boom' } })));
	const done = await new Client({ fetch }).waitForProfileInsight(JOB_ID);
	assert.equal(done.status, 'failed');
	assert.equal(done.error.message, 'boom');
});

test('waitForProfileInsight throws ProfileInsightTimeoutError after the timeout', async () => {
	const { fetch, requests } = mockFetch(json(job('running')));
	const started = Date.now();
	const error = await new Client({ fetch })
		.waitForProfileInsight(JOB_ID, { pollInterval: 10, timeout: 60 })
		.catch((caught) => caught);
	assert.ok(error instanceof ProfileInsightTimeoutError);
	assert.equal(error.jobId, JOB_ID);
	assert.equal(error.timeout, 60);
	assert.equal(error.job.status, 'running');
	assert.ok(requests.length >= 2);
	assert.ok(Date.now() - started < 1000);
	await assert.rejects(
		new Client({ fetch }).waitForProfileInsight(JOB_ID, { timeout: 0 }),
		/timeout must be a positive number/,
	);
	await assert.rejects(
		new Client({ fetch }).waitForProfileInsight(JOB_ID, { pollInterval: -1 }),
		/cannot be negative/,
	);
});

test('waitForProfileInsight stops when its signal aborts', async () => {
	const { fetch } = mockFetch(json(job('running')));
	const controller = new AbortController();
	setTimeout(() => controller.abort(new Error('stop')), 30);
	await assert.rejects(
		new Client({ fetch }).waitForProfileInsight(JOB_ID, {
			pollInterval: 1000,
			timeout: 10_000,
			signal: controller.signal,
		}),
		/stop/,
	);
});

test('the client timeout aborts slow requests', async () => {
	const fetch = (url, init) =>
		new Promise((resolve, reject) => {
			init.signal.addEventListener('abort', () => reject(init.signal.reason), { once: true });
		});
	// AbortSignal.timeout uses an unreferenced timer; a real socket would keep the process alive.
	const keepAlive = setTimeout(() => {}, 5_000);
	const error = await new Client({ fetch, timeout: 20 }).profile().catch((caught) => caught);
	clearTimeout(keepAlive);
	assert.equal(error.name, 'TimeoutError');
});

test('a caller signal aborts a request', async () => {
	const fetch = (url, init) =>
		new Promise((resolve, reject) => {
			init.signal.addEventListener('abort', () => reject(init.signal.reason), { once: true });
		});
	const controller = new AbortController();
	const pending = new Client({ fetch }).posts({ signal: controller.signal });
	controller.abort();
	const error = await pending.catch((caught) => caught);
	assert.equal(error.name, 'AbortError');
});

test('timeout: Infinity sends no signal unless the caller passes one', async () => {
	const { fetch, requests } = mockFetch(json({}));
	await new Client({ fetch, timeout: Infinity }).profile();
	assert.equal(requests[0].init.signal, undefined);
});

test('ApiError decodes the JSON error envelope', async () => {
	const { fetch } = mockFetch(
		json(
			{
				error: {
					code: 'POST_NOT_FOUND',
					message: 'No published post exists.',
					hint: 'List posts first.',
					docs_url: 'https://sudhanva.me/developers/',
				},
			},
			404,
		),
	);
	const error = await new Client({ fetch }).post('missing').catch((caught) => caught);
	assert.ok(error instanceof ApiError);
	assert.ok(error instanceof Error);
	assert.equal(error.name, 'ApiError');
	assert.equal(error.status, 404);
	assert.equal(error.code, 'POST_NOT_FOUND');
	assert.equal(error.message, 'No published post exists.');
	assert.equal(error.hint, 'List posts first.');
	assert.equal(error.docsUrl, 'https://sudhanva.me/developers/');
	assert.equal(error.body.error.code, 'POST_NOT_FOUND');
	assert.match(error.contentType, /application\/json/);
	assert.equal(error.headers.get('Content-Type'), 'application/json; charset=utf-8');
	assert.equal(String(error), 'ApiError: 404 POST_NOT_FOUND: No published post exists.');
});

test('ApiError decodes RFC 9457 problem+json documents', async () => {
	const problem = {
		type: 'https://sudhanva.me/docs/profile-insights/#invalid-profile-insight',
		title: 'Invalid profile insight request',
		status: 422,
		detail: 'audience must be one of the documented values.',
		instance: '/api/v1/profile-insights',
	};
	const { fetch } = mockFetch(
		new Response(JSON.stringify(problem), {
			status: 422,
			headers: { 'Content-Type': 'application/problem+json; charset=utf-8' },
		}),
	);
	const error = await new Client({ fetch })
		.createProfileInsight({ audience: 'nobody' }, 'abcdefgh')
		.catch((caught) => caught);
	assert.ok(error instanceof ApiError);
	assert.equal(error.status, 422);
	assert.equal(error.code, 'INVALID_PROFILE_INSIGHT');
	assert.equal(error.message, problem.detail);
	assert.equal(error.detail, problem.detail);
	assert.equal(error.title, problem.title);
	assert.equal(error.type, problem.type);
	assert.equal(error.instance, problem.instance);
	assert.equal(error.docsUrl, problem.type);
	assert.equal(error.hint, undefined);
	assert.deepEqual(error.body, problem);
});

test('ApiError handles problem documents without a detail or fragment', () => {
	const error = ApiError.fromResponse(
		400,
		'application/problem+json',
		JSON.stringify({ type: 'about:blank', title: 'Bad thing' }),
	);
	assert.equal(error.code, 'api_error');
	assert.equal(error.message, 'Bad thing');
	assert.equal(error.docsUrl, undefined);
	// A problem document served as application/json is still recognised.
	const sniffed = ApiError.fromResponse(
		409,
		'application/json',
		JSON.stringify({ type: 'https://x/#idempotency-key', title: 'Conflict', detail: 'In use.' }),
	);
	assert.equal(sniffed.code, 'IDEMPOTENCY_KEY');
	assert.equal(sniffed.message, 'In use.');
});

test('ApiError never throws on odd bodies', () => {
	const cases = [
		[
			502,
			'text/html',
			'<html>bad gateway</html>',
			'api_error',
			'Bad Gateway',
			'<html>bad gateway</html>',
		],
		[599, undefined, '', 'api_error', 'Request failed', null],
		[500, 'application/json', '[1,2,3]', 'api_error', 'Internal Server Error', [1, 2, 3]],
		[400, 'application/json', '{"error":"boom"}', 'api_error', 'boom', { error: 'boom' }],
		[400, 'application/json', '{"error":null}', 'api_error', 'Bad Request', { error: null }],
		[404, 'application/json', '"just a string"', 'api_error', 'Not Found', 'just a string'],
		[503, 'application/problem+json', '[]', 'api_error', 'Service Unavailable', []],
		[
			429,
			'application/json',
			'{"code":"RATE_LIMITED","message":"Slow down"}',
			'RATE_LIMITED',
			'Slow down',
			{ code: 'RATE_LIMITED', message: 'Slow down' },
		],
		[
			400,
			'application/json',
			'{"error":{"code":42,"message":["x"]}}',
			'api_error',
			'Bad Request',
			{ error: { code: 42, message: ['x'] } },
		],
	];
	for (const [status, contentType, body, code, message, decoded] of cases) {
		const error = ApiError.fromResponse(status, contentType, body);
		assert.ok(error instanceof ApiError);
		assert.equal(error.status, status);
		assert.equal(error.code, code, body);
		assert.equal(error.message, message, body);
		assert.deepEqual(error.body, decoded);
	}
});

test('NLWeb failures decode through the envelope', async () => {
	const { fetch } = mockFetch(
		json(
			{
				_meta: { response_type: 'failure', version: '0.55' },
				error: { code: 'INVALID_QUERY', message: 'query.text must contain text.' },
			},
			400,
		),
	);
	const error = await new Client({ fetch }).ask('x').catch((caught) => caught);
	assert.equal(error.code, 'INVALID_QUERY');
	assert.equal(error.message, 'query.text must contain text.');
});

test('a success response that is not JSON raises invalid_response', async () => {
	const { fetch } = mockFetch(new Response('<html>ok</html>', { status: 200 }));
	const error = await new Client({ fetch }).profile().catch((caught) => caught);
	assert.ok(error instanceof ApiError);
	assert.equal(error.status, 200);
	assert.equal(error.code, 'invalid_response');
	assert.equal(error.body, '<html>ok</html>');
});

test('network failures propagate unchanged', async () => {
	const failure = new TypeError('fetch failed');
	const client = new Client({
		fetch: async () => {
			throw failure;
		},
	});
	await assert.rejects(client.profile(), (error) => error === failure);
});

test('the global fetch is looked up at call time', async () => {
	const original = globalThis.fetch;
	const client = new Client();
	let called = false;
	globalThis.fetch = async () => {
		called = true;
		return json({ profile: {} });
	};
	try {
		await client.profile();
	} finally {
		globalThis.fetch = original;
	}
	assert.ok(called);
});

test('browsers do not get a User-Agent header', async () => {
	const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
	Object.defineProperty(globalThis, 'navigator', {
		value: { userAgent: 'Mozilla/5.0 (X11; Linux x86_64) Firefox/140.0' },
		configurable: true,
	});
	try {
		const { fetch, requests } = mockFetch(json({}));
		await new Client({ fetch }).profile();
		assert.equal(requests[0].init.headers['User-Agent'], undefined);
		assert.equal(requests[0].init.headers.Accept, 'application/json');
	} finally {
		if (descriptor) Object.defineProperty(globalThis, 'navigator', descriptor);
		else delete globalThis.navigator;
	}
});

test('the library entry imports no Node.js built-ins', async () => {
	const source = await readFile(new URL('../cli/index.js', import.meta.url), 'utf8');
	assert.doesNotMatch(source, /\bimport\b[^;]*\bfrom\b/);
	assert.doesNotMatch(source, /\brequire\(|\bprocess\.|\bBuffer\b|node:/);
});
