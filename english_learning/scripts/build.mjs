/* SPDX-License-Identifier: GPL-2.0-only */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const pluginDirectory = resolve(scriptDirectory, '..');
const repositoryDirectory = resolve(pluginDirectory, '..');
const version = (await readFile(resolve(pluginDirectory, 'VERSION'), 'utf8')).trim();
const order = JSON.parse(await readFile(resolve(pluginDirectory, 'build-order.json'), 'utf8'));

if (!Array.isArray(order) || order.length === 0) {
    throw new Error('build-order.json must contain at least one source file');
}

const modules = await Promise.all(order.map(async (relativePath) => {
    if (typeof relativePath !== 'string' || relativePath.indexOf('src/') !== 0) {
        throw new Error('Only src/ files are allowed in build-order.json');
    }

    return (await readFile(resolve(pluginDirectory, relativePath), 'utf8'))
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .replace(/\n+$/, '');
}));

const header = [
    '/*!',
    ' * English Learning for Lampa v' + version,
    ' * SPDX-License-Identifier: GPL-2.0-only',
    ' * Source: https://github.com/ndruxer2007/lampatv/tree/main/english_learning',
    ' * Generated file. Do not edit directly.',
    ' */',
    ''
].join('\n');

await writeFile(resolve(repositoryDirectory, 'english_learning.js'), header + modules.join('\n\n') + '\n', 'utf8');
