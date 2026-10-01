# Contributing

Bug reports and focused pull requests are welcome. Keep this repository small:
it contains the `sudhanva` package source (library and CLI), tests, release
verifier, and Homebrew formula only.

## Before opening a pull request

1. Create a branch from `main`.
2. Update the source, types, and tests together.
3. Run:

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

4. Describe the user-visible change and verification performed.

## Release checklist

Maintainers should use semantic versions and never replace an existing
versioned archive. For a release:

1. Update `VERSION` in `cli/index.js`, `cli/package.json`, and `CHANGELOG.md`.
2. Push to `main` and wait for CI to pass.
3. Create the GitHub release `vX.Y.Z`. The `release` workflow tests the package,
   attaches the `npm pack` archive and its SHA-256 to the release, and publishes
   that archive to npm with provenance through trusted publishing.
4. Publish the same archive as a new immutable file at `sudhanva.me/cli/`.
5. Update the formula URL and SHA-256 digest. Homebrew infers the version from
   the URL. `scripts/verify-release.mjs` checks that the archive matches the
   repository.

Do not include credentials, private data, generated Homebrew bottles, or
unrelated site code in this repository.
