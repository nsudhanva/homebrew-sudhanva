# `sudhanva` CLI

Dependency-free command-line client for the public
[sudhanva.me API](https://sudhanva.me/docs/).

Install from npm:

```sh
npm install --global sudhanva
```

Or install through the official Homebrew tap:

```sh
brew install nsudhanva/sudhanva/sudhanva
```

```sh
sudhanva profile
sudhanva posts --limit 5 --tag kubernetes
sudhanva post consolidating-milvus-across-azs
sudhanva insight --audience recruiter --focus production-ml,kubernetes --wait
```

The CLI requires Node.js 18 or newer and prints structured JSON to standard
output. Retrieval commands use HTTPS `GET`; `insight` creates an idempotent,
24-hour job using only published profile evidence. See the
[installation and command reference](https://sudhanva.me/developers/cli/).
The reviewed source, tests, and formula are public in the
[official Homebrew repository](https://github.com/nsudhanva/homebrew-sudhanva).
The package is distributed under the [MIT license](LICENSE).
