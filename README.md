# sudhanva: JavaScript SDK, CLI, and Homebrew tap

[![test](https://github.com/nsudhanva/homebrew-sudhanva/actions/workflows/test.yml/badge.svg)](https://github.com/nsudhanva/homebrew-sudhanva/actions/workflows/test.yml)
[![brew test-bot](https://github.com/nsudhanva/homebrew-sudhanva/actions/workflows/tests.yml/badge.svg)](https://github.com/nsudhanva/homebrew-sudhanva/actions/workflows/tests.yml)

Official source, GitHub Packages package, and Homebrew distribution for `@nsudhanva/sudhanva`, the
dependency-free JavaScript and TypeScript SDK and `sudhanva` CLI for the public
[sudhanva.me API](https://sudhanva.me/docs/). The package lives in [`cli/`](cli/); its
[README](cli/README.md) documents the library.

## Library

The package is published to
[GitHub Packages](https://github.com/nsudhanva/homebrew-sudhanva/pkgs/npm/sudhanva), which requires
a token even for public packages. Add this to your `.npmrc` once, with `GITHUB_TOKEN` set to a
personal access token (classic) that has the `read:packages` scope
([GitHub's guide](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-npm-registry)):

```ini
@nsudhanva:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

```sh
npm install @nsudhanva/sudhanva
```

```js
import { Client } from '@nsudhanva/sudhanva';

const client = new Client();
const { profile } = await client.profile();
const posts = await client.posts({ limit: 5, tag: 'kubernetes' });
```

The library runs on Node.js 22 and newer, Bun, Deno, browsers, and edge runtimes.

## CLI

The CLI needs Node.js 22 or newer. Install it without a token from the site-hosted archive:

```sh
mkdir -p "$HOME/.local/lib/sudhanva" "$HOME/.local/bin"
curl -fsSL https://sudhanva.me/cli/sudhanva-0.2.0.tgz | tar -xz -C "$HOME/.local/lib/sudhanva" --strip-components=1
ln -sf "$HOME/.local/lib/sudhanva/sudhanva.mjs" "$HOME/.local/bin/sudhanva"
```

with Homebrew:

```sh
brew install nsudhanva/sudhanva/sudhanva
```

or from GitHub Packages, with the `.npmrc` above:

```sh
npm install --global @nsudhanva/sudhanva
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
[`release.yml`](.github/workflows/release.yml), which publishes the package to GitHub Packages.
See [CONTRIBUTING.md](CONTRIBUTING.md) for the release checklist and
[SECURITY.md](SECURITY.md) for private security reporting.

## Links

- [SDK documentation](https://sudhanva.me/developers/sdks/)
- [CLI documentation](https://sudhanva.me/developers/cli/)
- [Versioning policy](https://sudhanva.me/developers/versioning/)
- [GitHub Packages package](https://github.com/nsudhanva/homebrew-sudhanva/pkgs/npm/sudhanva)
- [OpenAPI 3.1 contract](https://sudhanva.me/openapi.json)
- [MCP integration](https://sudhanva.me/developers/mcp/)
- [Profile-insights API](https://sudhanva.me/docs/profile-insights/)
- [Versioned CLI archive](https://sudhanva.me/cli/sudhanva-0.2.0.tgz)
- [Changelog](CHANGELOG.md)
- [MIT license](LICENSE)
