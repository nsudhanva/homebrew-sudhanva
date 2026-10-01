# Changelog

## 0.2.0

`@nsudhanva/sudhanva` on GitHub Packages is the official JavaScript and TypeScript SDK for the
public sudhanva.me API, and it installs the `sudhanva` CLI.

- `import { Client } from '@nsudhanva/sudhanva'` gives `profile`, `posts`, `allPosts`, `post`, `batch`, `ask`,
  `createProfileInsight`, `profileInsight`, `waitForProfileInsight`, and `apiIndex`, with the
  same names and behavior as the Python, Go, Ruby, and Rust SDKs.
- `ApiError` decodes both the JSON error envelope and `application/problem+json` documents, and
  falls back to generic values for bodies that are not JSON or have an unexpected shape.
- The package ships TypeScript types, has no runtime dependencies, and runs on Node.js 22 and
  newer, Bun, Deno, browsers, and edge runtimes.
- The CLI uses the library internally. Commands, flags, output, and exit codes are unchanged.
  `insight --wait` now prints the failure message of a failed job instead of `unknown error`.
  Requests send `User-Agent: sudhanva-js/0.2.0 sudhanva-cli/0.2.0`.
- The CLI and package now require Node.js 22 or newer, because Node.js 18 and 20 are past
  end of life.
- Releases are published to GitHub Packages from GitHub Actions.

## 0.1.5

- Added profile insights to the CLI.
