# Security policy

The CLI is public, read-only, and requires no credentials. It sends requests
only to the documented `https://sudhanva.me/api/v1` API unless a developer
explicitly sets `SUDHANVA_API_BASE` for local testing.

Report suspected vulnerabilities privately through
[GitHub Security Advisories](https://github.com/nsudhanva/homebrew-sudhanva/security/advisories/new).
Do not open a public issue for an unpatched vulnerability or include secrets,
tokens, or personal data in a report.

Supported security fixes target the latest published CLI version. Package
integrity is enforced by the SHA-256 digest in `Formula/sudhanva.rb`.
