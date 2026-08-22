/* SPDX-License-Identifier: GPL-2.0-only */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const testDirectory = dirname(fileURLToPath(import.meta.url));
const pluginDirectory = resolve(testDirectory, '..');
const repositoryDirectory = resolve(pluginDirectory, '..');

function build() {
    const result = spawnSync(process.execPath, ['scripts/build.mjs'], {
        cwd: pluginDirectory,
        encoding: 'utf8'
    });

    assert.equal(result.status, 0, result.stderr);
}

test('build creates the expected readable bundle', async () => {
    build();

    const bundle = await readFile(resolve(repositoryDirectory, 'english_learning.js'), 'utf8');
    assert.match(bundle, /English Learning for Lampa v0\.1\.0/);
    assert.match(bundle, /function start\(\)/);
    assert.match(bundle, /root\[namespace\]\.start\(\)/);
});

test('build is byte-for-byte deterministic', async () => {
    const bundlePath = resolve(repositoryDirectory, 'english_learning.js');

    build();
    const first = await readFile(bundlePath);
    build();
    const second = await readFile(bundlePath);

    assert.deepEqual(second, first);
});
