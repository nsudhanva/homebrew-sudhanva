// Client for the public sudhanva.me API.
//
// This module uses only web-standard globals (fetch, URL, AbortSignal, setTimeout), so it runs
// unchanged in Node.js, Deno, Bun, browsers, and edge runtimes. It has no runtime dependencies.

/** The version of this package. */
export const VERSION = '0.2.0';

/** The production API base URL. */
export const DEFAULT_BASE_URL = 'https://sudhanva.me/api/v1';

/** The User-Agent product token sent with every request. */
export const USER_AGENT = `sudhanva-js/${VERSION}`;

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_WAIT_TIMEOUT_MS = 30_000;
const DEFAULT_POLL_INTERVAL_MS = 1_000;
const TERMINAL_STATUSES = new Set(['succeeded', 'failed']);

const STATUS_TEXT = {
	400: 'Bad Request',
	401: 'Unauthorized',
	403: 'Forbidden',
	404: 'Not Found',
	405: 'Method Not Allowed',
	408: 'Request Timeout',
	409: 'Conflict',
	413: 'Content Too Large',
	415: 'Unsupported Media Type',
	422: 'Unprocessable Content',
	429: 'Too Many Requests',
	500: 'Internal Server Error',
	502: 'Bad Gateway',
	503: 'Service Unavailable',
	504: 'Gateway Timeout',
};

function isObject(value) {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value, key) {
	const field = isObject(value) ? value[key] : undefined;
	return typeof field === 'string' && field !== '' ? field : undefined;
}

/** Turns `https://.../#invalid-profile-insight` into `INVALID_PROFILE_INSIGHT`. */
function codeFromType(type) {
	const hash = type.indexOf('#');
	if (hash === -1 || hash === type.length - 1) return undefined;
	return type
		.slice(hash + 1)
		.replace(/[^A-Za-z0-9]/g, '_')
		.toUpperCase();
}

/**
 * A non-success response from the API.
 *
 * The API uses two error formats. Most endpoints return a JSON envelope,
 * `{"error": {"code", "message", "hint", "docs_url"}}`. Profile-insight request errors use RFC 9457
 * `application/problem+json`, `{"type", "title", "status", "detail", "instance"}`. For a problem
 * document, `message` is the `detail` (or `title`), `docsUrl` is the `type` URL, and `code` comes
 * from the `type` URL fragment, so `#idempotency-key` becomes `IDEMPOTENCY_KEY`.
 */
export class ApiError extends Error {
	constructor({
		status,
		code,
		message,
		hint,
		docsUrl,
		type,
		title,
		detail,
		instance,
		contentType,
		headers,
		body,
	}) {
		super(message);
		this.name = 'ApiError';
		this.status = status;
		this.code = code;
		this.hint = hint;
		this.docsUrl = docsUrl;
		this.type = type;
		this.title = title;
		this.detail = detail;
		this.instance = instance;
		this.contentType = contentType;
		this.headers = headers;
		this.body = body;
	}

	/**
	 * Builds an error from a status, content type, and raw body text. It never throws: bodies that
	 * are not JSON, are arrays, or carry an unexpected shape fall back to generic values.
	 */
	static fromResponse(status, contentType, bodyText, headers) {
		let body = null;
		if (bodyText) {
			try {
				body = JSON.parse(bodyText);
			} catch {
				body = bodyText;
			}
		}

		const init = { status, contentType, headers, body };
		const isProblem =
			(contentType ?? '').toLowerCase().includes('problem+json') ||
			(isObject(body) && body.error === undefined && text(body, 'title') !== undefined);

		if (isProblem && isObject(body)) {
			const type = text(body, 'type');
			init.type = type;
			init.title = text(body, 'title');
			init.detail = text(body, 'detail');
			init.instance = text(body, 'instance');
			init.message = init.detail ?? init.title;
			init.code = text(body, 'code') ?? (type ? codeFromType(type) : undefined);
			init.docsUrl = type && type !== 'about:blank' ? type : undefined;
		} else if (isObject(body)) {
			const envelope = isObject(body.error) ? body.error : body;
			init.code = text(envelope, 'code');
			init.message =
				text(envelope, 'message') ?? (typeof body.error === 'string' ? body.error : undefined);
			init.hint = text(envelope, 'hint');
			init.docsUrl = text(envelope, 'docs_url');
		}

		init.code ??= 'api_error';
		init.message ??= STATUS_TEXT[status] ?? 'Request failed';
		return new ApiError(init);
	}

	toString() {
		return `${this.name}: ${this.status} ${this.code}: ${this.message}`;
	}
}

/** Thrown by `waitForProfileInsight` when a job is still pending after the timeout. */
export class ProfileInsightTimeoutError extends Error {
	constructor(jobId, timeout, job) {
		super(`Profile insight ${jobId} did not finish within ${timeout} ms.`);
		this.name = 'ProfileInsightTimeoutError';
		this.jobId = jobId;
		this.timeout = timeout;
		this.job = job;
	}
}

// Browsers either drop a script-set User-Agent or, in Firefox, send it and trigger a CORS
// preflight that the API does not allow. Browser and web-worker user agents start with "Mozilla/";
// Node.js, Deno, Bun, and Cloudflare Workers report their own names.
function isBrowser() {
	const agent = globalThis.navigator?.userAgent;
	return typeof agent === 'string' && agent.startsWith('Mozilla/');
}

function invalid(message) {
	return new TypeError(message);
}

function abortReason(signal) {
	return signal.reason ?? new DOMException('This operation was aborted', 'AbortError');
}

/** Combines signals, preferring the native AbortSignal.any when the runtime has it. */
function anySignal(signals) {
	const active = signals.filter(Boolean);
	if (active.length <= 1) return active[0];
	if (typeof AbortSignal.any === 'function') return AbortSignal.any(active);
	const controller = new AbortController();
	for (const signal of active) {
		if (signal.aborted) {
			controller.abort(abortReason(signal));
			break;
		}
		signal.addEventListener('abort', () => controller.abort(abortReason(signal)), { once: true });
	}
	return controller.signal;
}

function timeoutSignal(milliseconds) {
	if (typeof AbortSignal.timeout === 'function') return AbortSignal.timeout(milliseconds);
	const controller = new AbortController();
	setTimeout(
		() => controller.abort(new DOMException('The operation timed out.', 'TimeoutError')),
		milliseconds,
	);
	return controller.signal;
}

function sleep(milliseconds, signal) {
	return new Promise((resolve, reject) => {
		if (signal?.aborted) {
			reject(abortReason(signal));
			return;
		}
		const onAbort = () => {
			clearTimeout(timer);
			reject(abortReason(signal));
		};
		const timer = setTimeout(() => {
			signal?.removeEventListener('abort', onAbort);
			resolve();
		}, milliseconds);
		signal?.addEventListener('abort', onAbort, { once: true });
	});
}

function checkLimit(limit, max) {
	if (limit === undefined) return;
	if (!Number.isInteger(limit) || limit < 1 || limit > max) {
		throw invalid(`limit must be an integer from 1 through ${max}`);
	}
}

function requireString(value, name) {
	if (typeof value !== 'string' || value === '') throw invalid(`${name} is required`);
}

/** A client for every stable public API operation. Instances are stateless and reusable. */
export class Client {
	#fetch;
	#timeout;
	#userAgent;

	constructor({ baseUrl = DEFAULT_BASE_URL, fetch, timeout = DEFAULT_TIMEOUT_MS, userAgent } = {}) {
		let url;
		try {
			url = new URL(String(baseUrl).replace(/\/+$/, ''));
		} catch {
			throw invalid('baseUrl must be an absolute HTTP(S) URL');
		}
		if (!['http:', 'https:'].includes(url.protocol)) {
			throw invalid('baseUrl must use HTTP or HTTPS');
		}
		if (!(typeof timeout === 'number' && timeout > 0) && timeout !== Infinity) {
			throw invalid('timeout must be a positive number of milliseconds');
		}
		const fetchImpl = fetch ?? globalThis.fetch;
		if (typeof fetchImpl !== 'function') {
			throw invalid('No fetch implementation is available; pass one with the fetch option');
		}
		url.search = '';
		url.hash = '';
		/** The API base URL without a trailing slash, such as `https://sudhanva.me/api/v1`. */
		this.baseUrl = url.href.replace(/\/+$/, '');
		/** The site origin, such as `https://sudhanva.me`. NLWeb `/ask` lives here. */
		this.siteUrl = url.origin;
		this.#fetch = fetch ? fetch : (...args) => globalThis.fetch(...args);
		this.#timeout = timeout;
		this.#userAgent = userAgent ? `${USER_AGENT} ${userAgent}` : USER_AGENT;
	}

	/** Returns the API index: version, documentation links, and endpoint URLs. */
	apiIndex({ locale, signal } = {}) {
		return this.#request('GET', this.#url([], { locale }), { signal });
	}

	/** Returns the published professional profile. */
	profile({ locale, signal } = {}) {
		return this.#request('GET', this.#url(['profile'], { locale }), { signal });
	}

	/** Returns a page of published articles, newest first. Follow `next_cursor` for more. */
	posts({ limit, tag, cursor, locale, signal } = {}) {
		checkLimit(limit, 100);
		return this.#request('GET', this.#url(['posts'], { limit, tag, cursor, locale }), { signal });
	}

	/** Iterates over every published article, following `next_cursor` page by page. */
	async *allPosts({ limit, tag, locale, signal } = {}) {
		let cursor;
		do {
			const page = await this.posts({ limit, tag, cursor, locale, signal });
			yield* page.posts ?? [];
			cursor = page.next_cursor ?? undefined;
		} while (cursor);
	}

	/** Returns metadata for one article by its canonical slug. */
	post(slug, { locale, signal } = {}) {
		requireString(slug, 'slug');
		return this.#request('GET', this.#url(['posts', slug], { locale }), { signal });
	}

	/** Runs 1 to 20 public reads in one request. `method` defaults to `GET`. */
	batch(operations, { signal } = {}) {
		if (!Array.isArray(operations) || operations.length < 1 || operations.length > 20) {
			throw invalid('operations must contain between 1 and 20 items');
		}
		const body = {
			operations: operations.map(({ id, method = 'GET', path }) => ({ id, method, path })),
		};
		return this.#request('POST', this.#url(['batch']), { body, signal });
	}

	/**
	 * Searches the published site with NLWeb 0.55 conversational search. The request goes to
	 * `/ask` on the site origin, not under the API base path. `method: 'GET'` sends only the
	 * query text, because the GET form does not accept a limit or mode.
	 */
	ask(text, { limit, mode, method = 'POST', signal } = {}) {
		requireString(text, 'text');
		checkLimit(limit, 20);
		if (method === 'GET') {
			if (limit !== undefined || mode !== undefined) {
				throw invalid('limit and mode require method POST');
			}
			const url = new URL('/ask', this.siteUrl);
			url.searchParams.set('query', text);
			return this.#request('GET', url.href, { signal });
		}
		if (method !== 'POST') throw invalid('method must be GET or POST');
		const body = {
			query: { text, site: this.siteUrl, limit: limit ?? 10 },
			prefer: { streaming: false, response_format: 'conversational_search', mode: mode ?? 'list' },
			meta: { version: '0.55' },
		};
		return this.#request('POST', new URL('/ask', this.siteUrl).href, { body, signal });
	}

	/**
	 * Creates a short-lived profile-insight job. The idempotency key is sent as the
	 * `Idempotency-Key` header; replaying the same key and request within 24 hours returns the same
	 * job, and reusing it with a different request returns a 422 error.
	 */
	createProfileInsight({ audience, focus } = {}, idempotencyKey, { signal } = {}) {
		requireString(audience, 'audience');
		requireString(idempotencyKey, 'idempotencyKey');
		const body = { audience, ...(focus === undefined ? {} : { focus: [...focus] }) };
		return this.#request('POST', this.#url(['profile-insights']), {
			body,
			headers: { 'Idempotency-Key': idempotencyKey },
			signal,
		});
	}

	/** Returns the current state of a profile-insight job. */
	profileInsight(jobId, { signal } = {}) {
		requireString(jobId, 'jobId');
		return this.#request('GET', this.#url(['profile-insights', jobId]), { signal });
	}

	/**
	 * Polls a profile-insight job until it succeeds or fails and returns it in that final state,
	 * including a `failed` job. Throws `ProfileInsightTimeoutError` when the job is still pending
	 * after `timeout` milliseconds.
	 */
	async waitForProfileInsight(
		jobId,
		{ pollInterval = DEFAULT_POLL_INTERVAL_MS, timeout = DEFAULT_WAIT_TIMEOUT_MS, signal } = {},
	) {
		requireString(jobId, 'jobId');
		if (!(typeof timeout === 'number' && timeout > 0)) {
			throw invalid('timeout must be a positive number of milliseconds');
		}
		if (!(typeof pollInterval === 'number' && pollInterval >= 0)) {
			throw invalid('pollInterval cannot be negative');
		}
		const started = Date.now();
		for (;;) {
			const job = await this.profileInsight(jobId, { signal });
			if (TERMINAL_STATUSES.has(job?.status)) return job;
			const elapsed = Date.now() - started;
			if (elapsed >= timeout) throw new ProfileInsightTimeoutError(jobId, timeout, job);
			await sleep(Math.min(pollInterval, timeout - elapsed), signal);
		}
	}

	#url(segments, query = {}) {
		const path = segments.map((segment) => `/${encodeURIComponent(segment)}`).join('');
		const url = new URL(`${this.baseUrl}${path}`);
		for (const [key, value] of Object.entries(query)) {
			if (value !== undefined && value !== null && value !== '') {
				url.searchParams.set(key, String(value));
			}
		}
		return url.href;
	}

	async #request(method, url, { body, headers = {}, signal } = {}) {
		const init = { method, headers: { Accept: 'application/json', ...headers } };
		if (!isBrowser()) init.headers['User-Agent'] = this.#userAgent;
		if (body !== undefined) {
			init.headers['Content-Type'] = 'application/json';
			init.body = JSON.stringify(body);
		}
		const combined = anySignal([
			signal,
			this.#timeout === Infinity ? undefined : timeoutSignal(this.#timeout),
		]);
		if (combined) init.signal = combined;

		const response = await this.#fetch(url, init);
		const contentType = response.headers?.get?.('Content-Type') ?? undefined;
		const raw = await response.text();
		if (!response.ok) {
			throw ApiError.fromResponse(response.status, contentType, raw, response.headers);
		}
		try {
			return JSON.parse(raw);
		} catch {
			throw new ApiError({
				status: response.status,
				code: 'invalid_response',
				message: 'The API returned a response that is not valid JSON.',
				contentType,
				headers: response.headers,
				body: raw,
			});
		}
	}
}
