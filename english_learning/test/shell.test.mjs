/* SPDX-License-Identifier: GPL-2.0-only */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const testDirectory = dirname(fileURLToPath(import.meta.url));
const bundlePath = resolve(testDirectory, '..', '..', 'english_learning.js');

async function runBundle(context) {
    const bundle = await readFile(bundlePath, 'utf8');
    vm.runInNewContext(bundle, context);
    return context.EnglishLearning;
}

test('shell quietly disables itself when Lampa is unavailable', async () => {
    const plugin = await runBundle({});
    assert.equal(plugin.getState().started, false);
    assert.equal(plugin.start(), false);
    plugin.destroy();
});

test('shell is idempotent and removes its Player listeners', async () => {
    const listeners = { ready: [], destroy: [], create: [], external: [] };
    const player = {
        listener: {
            follow(type, callback) { listeners[type].push(callback); },
            remove(type, callback) {
                const index = listeners[type].indexOf(callback);
                if (index !== -1) listeners[type].splice(index, 1);
            }
        }
    };
    const context = { Lampa: { Player: player } };
    const plugin = await runBundle(context);

    assert.equal(plugin.getState().started, true);
    assert.equal(plugin.start(), true);
    assert.equal(listeners.ready.length, 1);
    assert.equal(listeners.destroy.length, 1);

    plugin.destroy();
    plugin.destroy();
    assert.equal(listeners.ready.length, 0);
    assert.equal(listeners.destroy.length, 0);
});

test('re-evaluating the bundle replaces its callbacks without accumulation', async () => {
    const listeners = { ready: [], destroy: [], create: [], external: [] };
    const videoListeners = { timeupdate: [], pause: [], play: [] };
    const player = {
        listener: {
            follow(type, callback) { listeners[type].push(callback); },
            remove(type, callback) {
                const index = listeners[type].indexOf(callback);
                if (index !== -1) listeners[type].splice(index, 1);
            }
        }
    };
    const video = { listener: { follow(type, callback) { videoListeners[type].push(callback); }, remove(type, callback) { const index = videoListeners[type].indexOf(callback); if (index !== -1) videoListeners[type].splice(index, 1); } } };
    const context = { Lampa: { Player: player, PlayerVideo: video } };
    const firstPlugin = await runBundle(context);
    const secondPlugin = await runBundle(context);

    assert.notEqual(secondPlugin, firstPlugin);
    assert.equal(firstPlugin.getState().started, false);
    assert.equal(secondPlugin.getState().started, true);
    assert.equal(listeners.ready.length, 1);
    assert.equal(listeners.destroy.length, 1);
    assert.equal(videoListeners.timeupdate.length, 2);
    assert.equal(videoListeners.pause.length, 1);
    assert.equal(videoListeners.play.length, 1);
    secondPlugin.destroy();
    assert.equal(videoListeners.timeupdate.length, 0);
    assert.equal(videoListeners.pause.length, 0);
    assert.equal(videoListeners.play.length, 0);
});
