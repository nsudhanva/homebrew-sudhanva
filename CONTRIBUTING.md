# Contributing

Bug reports and focused pull requests are welcome. Keep this tap small: it
contains the `sudhanva` CLI source, tests, release verifier, and Homebrew
formula only.

## Before opening a pull request

1. Create a branch from `main`.
2. Update the CLI source and tests together.
3. Run:

   ```sh
   node --test tests/*.test.mjs
   node scripts/verify-release.mjs
   brew style Formula/sudhanva.rb
   brew audit --strict --online nsudhanva/sudhanva/sudhanva
   brew test nsudhanva/sudhanva/sudhanva
   ```

4. Describe the user-visible change and verification performed.

## Release checklist

Maintainers should use semantic versions and never replace an existing
versioned archive. For a release:

1. Update `VERSION` and `cli/package.json`.
2. Publish a new immutable archive at `sudhanva.me/cli/`.
3. Update the formula URL and SHA-256 digest. Homebrew infers the version from
   the URL.
4. Run the full checks above and merge only after CI passes.

Do not include credentials, private data, generated Homebrew bottles, or
unrelated site code in this repository.
