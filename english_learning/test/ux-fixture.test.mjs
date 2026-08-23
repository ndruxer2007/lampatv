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
        children: [], style: {}, hidden: false, textContent: '', parentNode: null, clientHeight: 180, clientWidth: 320,
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
    assert.match(html, /width:1920px; height:1080px/);
    assert.match(html, /bottom:6%/);
    assert.match(html, /font-size:56px/);
    assert.match(html, /max-height:75px/);
    assert.match(html, /max-height:64px/);
    assert.match(html, /player--panel-visible[^}]+bottom:20%/);
    assert.match(html, /pointer-events:none/);
    assert.match(html, /background:transparent/);
    assert.match(html, /english-learning-subtitles__plaque \{ max-width:1600px/);
    assert.match(html, /english-learning-subtitles__plaque \{[^}]*max-width:100%/);
    assert.match(html, /backdrop--soft[^}]+rgba\(0,0,0,.42\)/);
    assert.match(html, /backdrop--contrast[^}]+rgba\(0,0,0,.68\)/);
    assert.match(html, /player--tv player--panel-visible backdrop--soft/);
    assert.match(html, /player--small backdrop--contrast/);
    assert.match(html, /#FFD166/);
    assert.match(html, /#F5F5F5/);
    assert.match(html, /text-shadow:-2px -2px 0 rgba\(0,0,0,.88\)/);
    assert.match(html, /english-learning-subtitles__plaque/);
    assert.match(html, /aria-hidden="true"/);
    assert.match(html, /english-learning-pause-context[^}]+left:4%[^}]+top:162px[^}]+width:46vw[^}]+max-width:900px[^}]+max-height:430px/);
    assert.match(html, /player--tv\.player--panel-visible \.english-learning-pause-context[^}]+max-height:300px/);
    assert.match(html, /player--small \.english-learning-pause-context[^}]+top:32px[^}]+width:92vw[^}]+max-height:68px/);
    assert.match(html, /player--small\.has-current \.english-learning-pause-context[^}]+display:none/);
    assert.match(html, /TV paused with context/);
    assert.match(html, /TV paused controls visible with coordinated panels/);
    assert.match(html, /small paused: context hidden when current plaque leaves insufficient room/);
    assert.match(html, /Предыдущая русская фраза/);
    assert.match(html, /Русская строка/);
    assert.equal(html.includes('\uFFFD'), false);
    assert.equal(html.includes('Р '), false);
});

test('overlay implementation honours fixture geometry and disabled state without browser-only APIs', async () => {
    const host = element(), playerEvents = listener(), videoEvents = listener();
    const context = { Lampa: { Player: { listener: playerEvents, render: () => [host] }, PlayerVideo: { listener: videoEvents }, Storage: { get: () => ({}), set() {} } }, document: { createElement: element }, Promise, setTimeout, clearTimeout };
    vm.runInNewContext(await readFile(bundlePath, 'utf8'), context);
    context.EnglishLearning.configure({ enabled: true, transport: (url) => Promise.resolve(url === 'ru' ? 'WEBVTT\n\n1\n00:00:01.000 --> 00:00:03.000\nРусская строка' : 'WEBVTT\n\n1\n00:00:01.000 --> 00:00:03.000\nA very long safe line <img src=x onerror=1>') });
    playerEvents.send('ready', { subtitles: [{ label: 'EN', url: 'en' }, { label: 'RU', url: 'ru' }] });
    await new Promise((done) => setImmediate(done));
    videoEvents.send('timeupdate', { current: 2 });
    const overlay = host.children[0];
    const plaque = overlay.children[0], english = plaque.children[0], russian = plaque.children[1];
    assert.equal(overlay.style.bottom, '6%');
    assert.equal(english.style.fontSize, '31px');
    assert.equal(russian.style.fontSize, '22px');
    assert.equal(overlay.style.maxHeight, '75px');
    assert.equal(plaque.style.maxWidth, '281px');
    assert.equal(plaque.style.backgroundColor, 'transparent');
    assert.match(overlay.style.cssText, /pointer-events:none/);
    assert.equal(english.textContent, 'A very long safe line');
    host.classList.add('player--panel-visible');
    videoEvents.send('timeupdate', { current: 2 });
    assert.equal(overlay.style.bottom, '20%');
    assert.equal(overlay.style.maxHeight, '64px');
    context.EnglishLearning.configure({ subtitleFontSizePx: 72, subtitleBackdrop: 'soft' });
    assert.equal(context.EnglishLearning.getState().prototype.settings.subtitleFontSizePx, 72);
    assert.equal(english.style.fontSize, '25px');
    assert.equal(russian.style.fontSize, '18px');
    assert.equal(plaque.style.backgroundColor, 'rgba(0,0,0,.42)');
    assert.ok(25 * 1.15 + 18 * 1.18 + 4 + 8 <= 64);
    playerEvents.send('ready', { subtitles: [{ label: 'EN', url: 'en' }] });
    await new Promise((done) => setImmediate(done));
    videoEvents.send('timeupdate', { current: 2 });
    const englishOnly = host.children[0];
    const englishOnlyText = englishOnly.children[0].children[0];
    assert.equal(englishOnlyText.style.fontSize, '48px');
    assert.equal(englishOnly.style.maxHeight, '64px');
    context.EnglishLearning.configure({ enabled: false });
    assert.equal(host.children.length, 0);
});
