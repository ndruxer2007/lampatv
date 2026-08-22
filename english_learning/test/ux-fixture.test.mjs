/* SPDX-License-Identifier: GPL-2.0-only */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const directory = dirname(fileURLToPath(import.meta.url));
const bundlePath = resolve(directory, '..', '..', 'english_learning.js');
const fixturePath = resolve(directory, '..', 'fixtures', 'player-overlay-fixture.html');

function element() {
    const classes = new Set();
    return {
        children: [], style: {}, hidden: false, textContent: '', parentNode: null,
        classList: { contains: (name) => classes.has(name), add: (name) => classes.add(name), remove: (name) => classes.delete(name) },
        setAttribute() {}, appendChild(node) { node.parentNode = this; this.children.push(node); },
        removeChild(node) { this.children.splice(this.children.indexOf(node), 1); node.parentNode = null; }
    };
}

function listener() {
    const map = {};
    return { follow(name, fn) { (map[name] || (map[name] = [])).push(fn); }, remove(name, fn) { const list = map[name] || [], at = list.indexOf(fn); if (at >= 0) list.splice(at, 1); }, send(name, value) { (map[name] || []).slice().forEach((fn) => fn(value)); } };
}

test('local overlay fixture documents both controls states and small-viewport constraints', async () => {
    const html = await readFile(fixturePath, 'utf8');
    assert.match(html, /width:320px; height:180px/);
    assert.match(html, /bottom:9%/);
    assert.match(html, /player--panel-visible[^}]+bottom:18%/);
    assert.match(html, /pointer-events:none/);
    assert.match(html, /aria-hidden="true"/);
    assert.match(html, /Русская строка/);
    assert.equal(html.includes('\uFFFD'), false);
    assert.equal(html.includes('Р '), false);
});

test('overlay implementation honours fixture geometry and disabled state without browser-only APIs', async () => {
    const host = element(), playerEvents = listener(), videoEvents = listener();
    const context = { Lampa: { Player: { listener: playerEvents, render: () => [host] }, PlayerVideo: { listener: videoEvents }, Storage: { get: () => ({}), set() {} } }, document: { createElement: element }, Promise, setTimeout, clearTimeout };
    vm.runInNewContext(await readFile(bundlePath, 'utf8'), context);
    context.EnglishLearning.configure({ enabled: true, transport: () => Promise.resolve('WEBVTT\n\n1\n00:00:01.000 --> 00:00:03.000\nA very long safe line <img src=x onerror=1>') });
    playerEvents.send('ready', { subtitles: [{ label: 'EN', url: 'en' }] });
    await new Promise((done) => setImmediate(done));
    videoEvents.send('timeupdate', { current: 2 });
    const overlay = host.children[0];
    assert.equal(overlay.style.bottom, '9%');
    assert.match(overlay.style.cssText, /max-height:5em/);
    assert.match(overlay.style.cssText, /pointer-events:none/);
    assert.equal(overlay.children[0].textContent, 'A very long safe line');
    host.classList.add('player--panel-visible');
    videoEvents.send('timeupdate', { current: 2 });
    assert.equal(overlay.style.bottom, '18%');
    context.EnglishLearning.configure({ enabled: false });
    assert.equal(host.children.length, 0);
});
