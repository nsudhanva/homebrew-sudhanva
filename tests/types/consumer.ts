// Compile-only checks that the published types resolve through package.json "exports" and
// describe the API the way a TypeScript consumer uses it. Run with `npm run typecheck`.

import {
	ApiError,
	Client,
	DEFAULT_BASE_URL,
	ProfileInsightTimeoutError,
	USER_AGENT,
	VERSION,
	type AskResponse,
	type BatchResponse,
	type Post,
	type PostList,
	type ProfileInsightJob,
	type ProfileResponse,
} from 'sudhanva';

const version: string = VERSION;
const base: string = DEFAULT_BASE_URL;
const agent: string = USER_AGENT;

const client = new Client({
	baseUrl: new URL('http://localhost:8787/api/v1'),
	fetch: (input, init) => fetch(input, init),
	timeout: 5_000,
	userAgent: 'consumer-test/1.0',
});
new Client();
new Client({ timeout: Infinity });

// @ts-expect-error unknown option
new Client({ apiKey: 'nope' });

async function main(signal: AbortSignal): Promise<void> {
	const profile: ProfileResponse = await client.profile({ locale: 'en', signal });
	const name: string = profile.profile.name;
	const employer: string = profile.profile.worksFor.name;

	const page: PostList = await client.posts({ limit: 5, tag: 'kubernetes', cursor: 'abc' });
	const next: string | null = page.next_cursor;
	const category: string | null | undefined = page.posts[0]?.category;

	for await (const post of client.allPosts({ limit: 50 })) {
		const typed: Post = post;
		void typed.slug;
	}

	const article = await client.post('making-your-site-agent-friendly');
	const published: string = article.post.publishedAt;

	const batch: BatchResponse = await client.batch([
		{ id: 'profile', path: '/profile' },
		{ id: 'latest', method: 'GET', path: '/posts?limit=3' },
	]);
	const status: number = batch.results[0]!.status;

	// @ts-expect-error the API accepts only GET in batches
	await client.batch([{ id: 'x', method: 'POST', path: '/profile' }]);

	const answer: AskResponse = await client.ask('Kubernetes inference', {
		limit: 3,
		mode: 'list, summarize',
	});
	const kind: string = answer.results[0]!['@type'];
	await client.ask('milvus', { method: 'GET' });
	// @ts-expect-error unsupported NLWeb mode
	await client.ask('x', { mode: 'chat' });

	const job: ProfileInsightJob = await client.createProfileInsight(
		{ audience: 'hiring-manager', focus: ['production-ml', 'inference'] },
		'my-workflow-2026-10-01',
	);
	// @ts-expect-error audience is a closed set
	await client.createProfileInsight({ audience: 'robot' }, 'my-workflow-2026-10-01');
	// @ts-expect-error the idempotency key is required
	await client.createProfileInsight({ audience: 'agent' });

	const polled = await client.profileInsight(job.job_id);
	const done = await client.waitForProfileInsight(polled.job_id, {
		pollInterval: 500,
		timeout: 30_000,
		signal,
	});
	if (done.status === 'succeeded') {
		const summary: string | undefined = done.result?.summary;
		void summary;
	} else if (done.status === 'failed') {
		const reason: string | undefined = done.error?.message;
		void reason;
	}

	try {
		await client.post('missing');
	} catch (error) {
		if (error instanceof ApiError) {
			const fields: [number, string, string] = [error.status, error.code, error.message];
			const optional: (string | undefined)[] = [
				error.hint,
				error.docsUrl,
				error.type,
				error.title,
				error.detail,
				error.instance,
				error.contentType,
			];
			const retryAfter: string | null | undefined = error.headers?.get('Retry-After');
			const body: unknown = error.body;
			void [fields, optional, retryAfter, body];
		} else if (error instanceof ProfileInsightTimeoutError) {
			const pending: string = error.job.status;
			void [error.jobId, error.timeout, pending];
		}
	}

	const decoded: ApiError = ApiError.fromResponse(404, 'application/json', '{}');
	void [name, employer, next, category, published, status, kind, decoded];
}

void [version, base, agent, main];
