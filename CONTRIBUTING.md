# Contributing

You can send bug reports and focused pull requests. Keep this repository small. It contains only
the source of the `@nsudhanva/sudhanva` package (library and CLI), the tests, the release
verifier, and the Homebrew formula.

Do not put credentials, private data, generated Homebrew bottles, or unrelated site code in this
repository.

## Before you open a pull request

1. Create a branch from `main`.
2. Update the source, the types, and the tests in the same change.
3. Run these commands:

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

4. In the pull request, describe the change that users can see. Also describe the checks that you
   did.

## Release checklist

Maintainers must use semantic versions. They must not replace a versioned archive that is already
published.

To make a release:

1. Update `VERSION` in `cli/index.js`, `cli/package.json`, and `CHANGELOG.md`.
2. Push to `main`. Wait for CI to pass.
3. Create the GitHub release `vX.Y.Z`. The `release` workflow then does these steps:
   - It tests the package.
   - It attaches the `npm pack` archive and its SHA-256 to the release.
   - It publishes that archive to GitHub Packages with the `GITHUB_TOKEN` of the workflow.

   If the publish fails, run `gh workflow run release.yml -f tag=vX.Y.Z` to try again. This
   command uses the archive that is attached to the release.
4. Publish the same archive as a new immutable file at `sudhanva.me/cli/`.
5. Update the URL and the SHA-256 digest in the formula. Homebrew gets the version from the URL.
   `scripts/verify-release.mjs` checks that the archive matches the repository.
