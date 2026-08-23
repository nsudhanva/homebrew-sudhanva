import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const repositoryRoot = new URL('../', import.meta.url);
const formula = await readFile(new URL('Formula/sudhanva.rb', repositoryRoot), 'utf8');
const localSource = await readFile(new URL('cli/sudhanva.mjs', repositoryRoot), 'utf8');
const localLicense = await readFile(new URL('cli/LICENSE', repositoryRoot), 'utf8');
const repositoryLicense = await readFile(new URL('LICENSE', repositoryRoot), 'utf8');
const localPackage = JSON.parse(
	await readFile(new URL('cli/package.json', repositoryRoot), 'utf8'),
);

const releaseUrl = formula.match(/^\s*url "([^"]+)"/m)?.[1];
const formulaVersion =
	formula.match(/^\s*version "([^"]+)"/m)?.[1] ?? releaseUrl?.match(/-(\d+(?:\.\d+)+)\.tgz$/)?.[1];
const expectedDigest = formula.match(/^\s*sha256 "([0-9a-f]{64})"/m)?.[1];

assert.ok(releaseUrl, 'Formula must declare a release URL.');
assert.ok(formulaVersion, 'Formula release URL must contain a semantic version.');
assert.ok(expectedDigest, 'Formula must declare a lowercase SHA-256 digest.');
assert.equal(formulaVersion, localPackage.version, 'Formula and package versions must match.');
assert.equal(localLicense, repositoryLicense, 'Repository and package licenses must match.');

const [archiveResponse, sourceResponse, packageResponse, licenseResponse] = await Promise.all([
	fetch(releaseUrl),
	fetch('https://sudhanva.me/cli/sudhanva.mjs'),
	fetch('https://sudhanva.me/cli/package.json'),
	fetch('https://sudhanva.me/cli/LICENSE'),
]);

for (const response of [archiveResponse, sourceResponse, packageResponse, licenseResponse]) {
	assert.equal(response.status, 200, `${response.url} returned HTTP ${response.status}.`);
}

const archive = Buffer.from(await archiveResponse.arrayBuffer());
const actualDigest = createHash('sha256').update(archive).digest('hex');
assert.equal(actualDigest, expectedDigest, 'Published archive digest does not match the formula.');
assert.equal(
	await sourceResponse.text(),
	localSource,
	'Published and repository CLI sources differ.',
);
assert.deepEqual(
	await packageResponse.json(),
	localPackage,
	'Published and repository package metadata differ.',
);
assert.equal(
	await licenseResponse.text(),
	localLicense,
	'Published and repository licenses differ.',
);

console.log(`Verified sudhanva ${formulaVersion} release (${actualDigest}).`);
