# Homebrew tap for `sudhanva`

Official Homebrew distribution for the public, read-only
[`sudhanva.me` command-line interface](https://sudhanva.me/developers/cli/).

## Install

```sh
brew install nsudhanva/sudhanva/sudhanva
```

The formula installs the immutable versioned archive published by
[`sudhanva.me`](https://sudhanva.me/cli/nsudhanva-sudhanva-0.1.0.tgz). The CLI
requires Node.js, sends no credentials, performs only documented HTTPS `GET`
requests, and prints structured JSON.

## Use

```sh
sudhanva profile
sudhanva posts --limit 5 --tag kubernetes
sudhanva --version
```

- [Developer documentation](https://sudhanva.me/docs/)
- [OpenAPI 3.1 specification](https://sudhanva.me/openapi.json)
- [MCP server](https://sudhanva.me/developers/mcp/)

