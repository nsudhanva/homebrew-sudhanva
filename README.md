# sudhanva: JavaScript SDK, CLI, and Homebrew tap

[![test](https://github.com/nsudhanva/homebrew-sudhanva/actions/workflows/test.yml/badge.svg)](https://github.com/nsudhanva/homebrew-sudhanva/actions/workflows/test.yml)
[![brew test-bot](https://github.com/nsudhanva/homebrew-sudhanva/actions/workflows/tests.yml/badge.svg)](https://github.com/nsudhanva/homebrew-sudhanva/actions/workflows/tests.yml)

Official source, npm package, and Homebrew distribution for `sudhanva`, the dependency-free
JavaScript and TypeScript SDK and CLI for the public [sudhanva.me API](https://sudhanva.me/docs/).
The package lives in [`cli/`](cli/); its [README](cli/README.md) documents the library.

## Library

```sh
npm install sudhanva
```

```js
import { Client } from 'sudhanva';

const client = new Client();
const { profile } = await client.profile();
const posts = await client.posts({ limit: 5, tag: 'kubernetes' });
```

The library runs on Node.js 22 and newer, Bun, Deno, browsers, and edge runtimes.

## CLI

```sh
npm install --global sudhanva
```

or:

```sh
brew install nsudhanva/sudhanva/sudhanva
```

Homebrew installs Node.js when needed. The CLI requires no account or API key,
sends no credentials, and writes JSON to standard output. Retrieval commands use HTTPS
`GET`; profile insights use the documented idempotent asynchronous API.

## Use

```sh
sudhanva profile
sudhanva posts --limit 5 --tag kubernetes
sudhanva post bare-metal-kubernetes-homelab-setup --compact
sudhanva insight --audience recruiter --focus production-ml,kubernetes --wait
sudhanva --version
```

| Command              | Result                                    |
| -------------------- | ----------------------------------------- |
| `sudhanva api`       | API discovery document                    |
| `sudhanva profile`   | Published professional profile            |
| `sudhanva posts`     | Published article metadata                |
| `sudhanva post SLUG` | Metadata for one article                  |
| `sudhanva insight …` | Create and optionally poll an insight job |
| `sudhanva --help`    | Complete command reference                |

Use `--compact` for single-line JSON. `posts` also accepts `--limit`, `--tag`,
and `--cursor`. `insight` requires `--audience`, accepts comma-separated `--focus`,
and supports `--wait`. Run `sudhanva --help` for the complete syntax.

## Maintain

```sh
npm install
npm test
npm run typecheck
npm run lint:package
npm run smoke
node scripts/verify-release.mjs
brew style Formula/sudhanva.rb
brew audit --strict --online nsudhanva/sudhanva/sudhanva
brew test nsudhanva/sudhanva/sudhanva
```

`npm test` runs offline against a mocked `fetch`. `npm run smoke` calls production.
The formula downloads a versioned archive and verifies its SHA-256 digest.
CI runs the tests on Node.js 22.0.0, 22, 24, and 26, the library tests on Bun and Deno, and
Homebrew's official `brew test-bot` workflow on macOS and Linux. Publishing a GitHub release runs
[`release.yml`](.github/workflows/release.yml), which publishes to npm through trusted publishing.
See [CONTRIBUTING.md](CONTRIBUTING.md) for the release checklist and
[SECURITY.md](SECURITY.md) for private security reporting.

## Links

- [SDK documentation](https://sudhanva.me/developers/sdks/)
- [CLI documentation](https://sudhanva.me/developers/cli/)
- [Versioning policy](https://sudhanva.me/developers/versioning/)
- [npm package](https://www.npmjs.com/package/sudhanva)
- [OpenAPI 3.1 contract](https://sudhanva.me/openapi.json)
- [MCP integration](https://sudhanva.me/developers/mcp/)
- [Profile-insights API](https://sudhanva.me/docs/profile-insights/)
- [Versioned CLI archive](https://sudhanva.me/cli/sudhanva-0.1.5.tgz)
- [Changelog](CHANGELOG.md)
- [MIT license](LICENSE)
