# sudhanva: JavaScript SDK, CLI, and Homebrew tap

[![test](https://github.com/nsudhanva/homebrew-sudhanva/actions/workflows/test.yml/badge.svg)](https://github.com/nsudhanva/homebrew-sudhanva/actions/workflows/test.yml)
[![brew test-bot](https://github.com/nsudhanva/homebrew-sudhanva/actions/workflows/tests.yml/badge.svg)](https://github.com/nsudhanva/homebrew-sudhanva/actions/workflows/tests.yml)

This repository contains the official source, the GitHub Packages package, and the Homebrew tap
for `@nsudhanva/sudhanva`. This package is a JavaScript and TypeScript SDK with no dependencies.
It also contains the `sudhanva` CLI for the public [sudhanva.me API](https://sudhanva.me/docs/).

The package is in [`cli/`](cli/). Its [README](cli/README.md) documents the library.

## Library

The package is on
[GitHub Packages](https://github.com/nsudhanva/homebrew-sudhanva/pkgs/npm/sudhanva). GitHub Packages
needs a token, also for public packages. Set `GITHUB_TOKEN` to a personal access token (classic)
that has the `read:packages` scope. For more information, read
[GitHub's guide](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-npm-registry).

Add these lines to your `.npmrc` one time:

```ini
@nsudhanva:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

Install the package:

```sh
npm install @nsudhanva/sudhanva
```

Use the client:

```js
import { Client } from '@nsudhanva/sudhanva';

const client = new Client();
const { profile } = await client.profile();
const posts = await client.posts({ limit: 5, tag: 'kubernetes' });
```

The library runs on Node.js 22 and later versions, Bun, Deno, browsers, and edge runtimes.

## CLI

The CLI needs Node.js 22 or a later version. You can install it in three ways.

To install it from the archive on the site, use these commands. You do not need a token:

```sh
mkdir -p "$HOME/.local/lib/sudhanva" "$HOME/.local/bin"
curl -fsSL https://sudhanva.me/cli/sudhanva-0.2.0.tgz | tar -xz -C "$HOME/.local/lib/sudhanva" --strip-components=1
ln -sf "$HOME/.local/lib/sudhanva/sudhanva.mjs" "$HOME/.local/bin/sudhanva"
```

To install it with Homebrew, use this command:

```sh
brew install nsudhanva/sudhanva/sudhanva
```

Homebrew installs Node.js if it is necessary.

To install it from GitHub Packages, use the `.npmrc` from the Library section and this command:

```sh
npm install --global @nsudhanva/sudhanva
```

The CLI does not need an account or an API key. It does not send credentials. It writes JSON to
standard output. Retrieval commands use HTTPS `GET`. Profile insights use the documented idempotent
asynchronous API.

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

Use `--compact` to get JSON on a single line. The `posts` command also accepts `--limit`, `--tag`,
and `--cursor`. The `insight` command must have `--audience`. It also accepts `--wait` and a
comma-separated list for `--focus`. To see the complete syntax, run `sudhanva --help`.

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

`npm test` runs offline with a mocked `fetch`. `npm run smoke` calls production. The formula
downloads a versioned archive and checks its SHA-256 digest.

CI does these checks:

- It runs the tests on Node.js 22.0.0, 22, 24, and 26.
- It runs the library tests on Bun and Deno.
- It runs the official Homebrew `brew test-bot` workflow on macOS and Linux.

When you publish a GitHub release, the [`release.yml`](.github/workflows/release.yml) workflow
starts. This workflow publishes the package to GitHub Packages.

For the release checklist, read [CONTRIBUTING.md](CONTRIBUTING.md). To report a security problem
privately, read [SECURITY.md](SECURITY.md).

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
