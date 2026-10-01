// Checks the archive the Homebrew formula installs: its URL, SHA-256 digest, and contents.
//
// When cli/package.json carries the same version as the formula, every packaged file in the
// archive must match the repository. When the package is ahead of the formula, the new version
// has not been released yet; the script checks the current archive and says the release is pending.

import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

const repositoryRoot = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, repositoryRoot), 'utf8');

const formula = await read('Formula/sudhanva.rb');
const localPackage = JSON.parse(await read('cli/package.json'));
assert.equal(
	await read('cli/LICENSE'),
	await read('LICENSE'),
	'Package and repository licenses differ.',
);

const releaseUrl = formula.match(/^\s*url "([^"]+)"/m)?.[1];
const formulaVersion =
	formula.match(/^\s*version "([^"]+)"/m)?.[1] ?? releaseUrl?.match(/-(\d+(?:\.\d+)+)\.tgz$/)?.[1];
const expectedDigest = formula.match(/^\s*sha256 "([0-9a-f]{64})"/m)?.[1];

assert.ok(releaseUrl, 'Formula must declare a release URL.');
assert.ok(formulaVersion, 'Formula release URL must contain a semantic version.');
assert.ok(expectedDigest, 'Formula must declare a lowercase SHA-256 digest.');

const compare = (left, right) => {
	const a = left.split('.').map(Number);
	const b = right.split('.').map(Number);
	for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
		if ((a[index] ?? 0) !== (b[index] ?? 0)) return (a[index] ?? 0) - (b[index] ?? 0);
	}
	return 0;
};
const order = compare(localPackage.version, formulaVersion);
assert.ok(
	order >= 0,
	`cli/package.json (${localPackage.version}) is older than the formula (${formulaVersion}).`,
);

const response = await fetch(releaseUrl);
assert.equal(response.status, 200, `${releaseUrl} returned HTTP ${response.status}.`);
const archive = Buffer.from(await response.arrayBuffer());
const actualDigest = createHash('sha256').update(archive).digest('hex');
assert.equal(actualDigest, expectedDigest, 'Published archive digest does not match the formula.');

const directory = await mkdtemp(join(tmpdir(), 'sudhanva-release-'));
await writeFile(join(directory, 'release.tgz'), archive);
await promisify(execFile)('tar', ['-xzf', 'release.tgz'], { cwd: directory });
const packaged = (path) => readFile(join(directory, 'package', path), 'utf8');
const archivedPackage = JSON.parse(await packaged('package.json'));
assert.equal(archivedPackage.name, '@nsudhanva/sudhanva');
assert.equal(archivedPackage.version, formulaVersion, 'Archive and formula versions differ.');

if (order === 0) {
	assert.deepEqual(archivedPackage, localPackage, 'Archived and repository package.json differ.');
	for (const file of localPackage.files) {
		assert.equal(await packaged(file), await read(`cli/${file}`), `Archived ${file} differs.`);
	}
	console.log(`Verified sudhanva ${formulaVersion} release (${actualDigest}).`);
} else {
	console.log(
		`Verified sudhanva ${formulaVersion} release (${actualDigest}). ` +
			`Release of ${localPackage.version} is pending: update the formula once its archive is published.`,
	);
}
