# Security policy

The CLI is public. It does not need credentials. Retrieval commands are read-only. The
profile-insights command creates only a temporary record that lasts 24 hours. This record uses
only published site evidence.

The CLI sends requests only to the documented `https://sudhanva.me/api/v1` API. The only exception
is when a developer sets `SUDHANVA_API_BASE` for local tests.

Do not open a public issue for a vulnerability that is not fixed. Do not put secrets, tokens, or
personal data in a report. Report a possible vulnerability privately through
[GitHub Security Advisories](https://github.com/nsudhanva/homebrew-sudhanva/security/advisories/new).

Security fixes go into the latest published CLI version. The SHA-256 digest in
`Formula/sudhanva.rb` protects the integrity of the package.
