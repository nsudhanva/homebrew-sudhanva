# sudhanva for JavaScript and TypeScript

Official JavaScript and TypeScript client and CLI for the public
[sudhanva.me API](https://sudhanva.me/openapi.json). It retrieves published profile and article
metadata, performs bounded batch reads, searches the published site, and creates or polls temporary
profile-insight jobs.

The API is public and requires no credentials. Do not send private data.

## Install

```sh
npm install sudhanva
```

The package has no runtime dependencies. It ships ES modules with TypeScript types.

## Use

```js
import { Client } from 'sudhanva';

const client = new Client();

const { profile } = await client.profile();
const posts = await client.posts({ limit: 5, tag: 'kubernetes' });
const article = await client.post('making-your-site-agent-friendly');

const job = await client.createProfileInsight(
	{ audience: 'hiring-manager', focus: ['production-ml', 'inference'] },
	'my-workflow-2026-10-01',
);
const done = await client.waitForProfileInsight(job.job_id);
console.log(done.result?.summary);
```

Profile-insight requests require a caller-controlled idempotency key, sent as the
`Idempotency-Key` header. Replaying the same key and request within 24 hours returns the same job;
reusing the key with a different request returns a 422 error.

`waitForProfileInsight` returns the job once it is `succeeded` or `failed`. It polls every second
for up to 30 seconds by default and throws `ProfileInsightTimeoutError` if the job is still
pending. Pass `{ pollInterval, timeout, signal }` in milliseconds to change that.

Every method returns the decoded JSON body. Non-success responses throw `ApiError` with `status`,
`code`, `message`, `hint`, `docsUrl`, and the decoded `body`. Both the JSON error envelope and the
`application/problem+json` documents returned by profile-insight requests are decoded; for a
problem document, `type`, `title`, `detail`, and `instance` are set too, and `code` comes from the
`type` URL fragment (`#invalid-profile-insight` becomes `INVALID_PROFILE_INSIGHT`).

```js
import { ApiError } from 'sudhanva';

try {
	await client.post('missing');
} catch (error) {
	if (error instanceof ApiError && error.status === 404) {
		console.log(error.code, error.hint);
	} else {
		throw error;
	}
}
```

To read every post, follow `next_cursor`, or let `allPosts()` do it:

```js
for await (const post of client.allPosts({ limit: 50 })) {
	console.log(post.title);
}
```

### Options

```js
const client = new Client({
	baseUrl: 'http://localhost:8787/api/v1', // default: https://sudhanva.me/api/v1
	fetch: myFetch, // default: the global fetch
	timeout: 30_000, // per request, in milliseconds; default 10000
	userAgent: 'my-app/1.0', // appended to the User-Agent header
});
```

Every method also accepts an `AbortSignal` as `signal`, which is combined with the client timeout.
Outside browsers, every request sends `User-Agent: sudhanva-js/0.2.0`, followed by your
`userAgent` if you set one. Browsers do not get a `User-Agent` header, because the API's CORS policy
does not allow it.

## API coverage

| Operation                        | Method                                                               |
| -------------------------------- | -------------------------------------------------------------------- |
| `GET /`                          | `apiIndex({ locale })`                                               |
| `GET /profile`                   | `profile({ locale })`                                                |
| `GET /posts`                     | `posts({ limit, tag, cursor, locale })` and `allPosts()`             |
| `GET /posts/{slug}`              | `post(slug)`                                                         |
| `POST /batch`                    | `batch(operations)` with 1 to 20 operations                          |
| `POST /profile-insights`         | `createProfileInsight({ audience, focus }, idempotencyKey)`          |
| `GET /profile-insights/{job_id}` | `profileInsight(jobId)` and `waitForProfileInsight(jobId, options)`  |
| `POST /ask` or `GET /ask`        | `ask(text, { limit, mode, method })` for NLWeb conversational search |

`ask` sends `POST /ask` to the site origin by default. `{ method: 'GET' }` sends
`GET /ask?query=...`, which does not accept a limit or mode.

The client follows the stable `/api/v1` contract. See the
[developer documentation](https://sudhanva.me/developers/sdks/) and
[versioning policy](https://sudhanva.me/developers/versioning/).

## Runtime support

The library uses only `fetch`, `URL`, `AbortSignal`, and timers, and imports no Node.js modules. It
runs in:

- Node.js 22, 24, and 26, the releases that are maintained today. CI tests 22.0.0 and the latest
  of each major.
- Bun and Deno. CI runs the library test suite on both.
- Browsers, web workers, and edge runtimes such as Cloudflare Workers.

The package is ESM only. On Node.js 22.12 and newer, CommonJS code can `require('sudhanva')`;
older releases need `await import('sudhanva')`.

## CLI

The same package installs the `sudhanva` command. It needs Node.js 22 or newer.

```sh
npm install --global sudhanva
```

Or install through the official Homebrew tap:

```sh
brew install nsudhanva/sudhanva/sudhanva
```

```sh
sudhanva api
sudhanva profile
sudhanva posts --limit 5 --tag kubernetes
sudhanva post consolidating-milvus-across-azs
sudhanva insight --audience recruiter --focus production-ml,kubernetes --wait
sudhanva --version
```

The CLI prints structured JSON to standard output and exits with status 1 on HTTP, validation, or
API errors. Add `--compact` for single-line JSON. Retrieval commands use HTTPS `GET`; `insight`
creates an idempotent, 24-hour job using only published profile evidence. See the
[installation and command reference](https://sudhanva.me/developers/cli/).

## Development

```sh
npm install
npm test                # offline: mocked fetch, CLI, and package checks
npm run typecheck       # compiles a TypeScript consumer against the published types
npm run lint:package    # publint and Are the Types Wrong
npm run smoke           # live checks against https://sudhanva.me
```

Run these from the repository root. The source, tests, and Homebrew formula are public in the
[official repository](https://github.com/nsudhanva/homebrew-sudhanva). The package is distributed
under the [MIT license](LICENSE).
