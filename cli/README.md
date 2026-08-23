# `sudhanva` CLI

Dependency-free command-line client for the public, read-only
[sudhanva.me API](https://sudhanva.me/docs/).

Install through the official Homebrew tap:

```sh
brew install nsudhanva/sudhanva/sudhanva
```

```sh
sudhanva profile
sudhanva posts --limit 5 --tag kubernetes
sudhanva post consolidating-milvus-across-azs
```

The CLI requires Node.js 18 or newer, performs only HTTPS `GET` requests, and
prints structured JSON to standard output. See the
[installation and command reference](https://sudhanva.me/developers/cli/).
The reviewed source, tests, and formula are public in the
[official Homebrew repository](https://github.com/nsudhanva/homebrew-sudhanva).
