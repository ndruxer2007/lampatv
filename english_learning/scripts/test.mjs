/* SPDX-License-Identifier: GPL-2.0-only */
import { readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const pluginDirectory = resolve(scriptDirectory, '..');
const testDirectory = resolve(pluginDirectory, 'test');
const tests = (await readdir(testDirectory)).filter((name) => /\.test\.mjs$/.test(name)).sort().map((name) => resolve(testDirectory, name));

if (!tests.length) throw new Error('No test files found');

const result = spawnSync(process.execPath, ['--test', '--test-concurrency=1'].concat(tests), {
    cwd: resolve(pluginDirectory, '..'),
    encoding: 'utf8'
});

process.stdout.write(result.stdout || '');
process.stderr.write(result.stderr || '');
if (result.error) throw result.error;
if (result.status !== 0) process.exitCode = result.status || 1;
