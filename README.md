# sudhanva Homebrew tap

[![brew test-bot](https://github.com/nsudhanva/homebrew-sudhanva/actions/workflows/tests.yml/badge.svg)](https://github.com/nsudhanva/homebrew-sudhanva/actions/workflows/tests.yml)

Official source, npm package, and Homebrew distribution for `sudhanva`, a dependency-free,
read-only CLI for the public [sudhanva.me API](https://sudhanva.me/docs/).

## Install

```sh
npm install --global @initiable/sudhanva
```

or:

```sh
brew install nsudhanva/sudhanva/sudhanva
```

Homebrew installs Node.js when needed. The CLI requires no account or API key,
sends only documented HTTPS `GET` requests, and writes JSON to standard output.

## Use

```sh
sudhanva profile
sudhanva posts --limit 5 --tag kubernetes
sudhanva post bare-metal-kubernetes-homelab-setup --compact
sudhanva --version
```

| Command              | Result                         |
| -------------------- | ------------------------------ |
| `sudhanva api`       | API discovery document         |
| `sudhanva profile`   | Published professional profile |
| `sudhanva posts`     | Published article metadata     |
| `sudhanva post SLUG` | Metadata for one article       |
| `sudhanva --help`    | Complete command reference     |

Use `--compact` for single-line JSON. `posts` also accepts `--limit`, `--tag`,
and `--cursor`. Run `sudhanva --help` for the complete syntax.

## Maintain

```sh
node --test tests/*.test.mjs
node scripts/verify-release.mjs
brew style Formula/sudhanva.rb
brew audit --strict --online nsudhanva/sudhanva/sudhanva
brew test nsudhanva/sudhanva/sudhanva
```

The formula downloads a versioned archive and verifies its SHA-256 digest.
CI uses Homebrew's official `brew test-bot` workflow on macOS and Linux.
See [CONTRIBUTING.md](CONTRIBUTING.md) for the release checklist and
[SECURITY.md](SECURITY.md) for private security reporting.

## Links

- [CLI documentation](https://sudhanva.me/developers/cli/)
- [npm package](https://www.npmjs.com/package/@initiable/sudhanva)
- [OpenAPI 3.1 contract](https://sudhanva.me/openapi.json)
- [MCP integration](https://sudhanva.me/developers/mcp/)
- [Versioned CLI archive](https://sudhanva.me/cli/initiable-sudhanva-0.1.3.tgz)
- [MIT license](LICENSE)
