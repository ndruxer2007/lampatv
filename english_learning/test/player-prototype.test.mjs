/* SPDX-License-Identifier: GPL-2.0-only */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const directory = dirname(fileURLToPath(import.meta.url));
const bundlePath = resolve(directory, '..', '..', 'english_learning.js');

function fakeElement() {
    const classes = new Set();
    return {
        children: [], style: {}, hidden: false, textContent: '', parentNode: null,
        classList: { contains: (value) => classes.has(value), add: (value) => classes.add(value) },
        setAttribute() {},
        appendChild(node) { node.parentNode = this; this.children.push(node); },
        removeChild(node) { this.children.splice(this.children.indexOf(node), 1); node.parentNode = null; }
    };
}

function listener() {
    const map = {};
    return {
        follow(type, callback) { (map[type] || (map[type] = [])).push(callback); },
        remove(type, callback) { const list = map[type] || []; const at = list.indexOf(callback); if (at !== -1) list.splice(at, 1); },
        send(type, value) { (map[type] || []).slice().forEach((callback) => callback(value)); },
        count(type) { return (map[type] || []).length; }
    };
}

async function setup() {
    const host = fakeElement();
    const events = listener();
    const videoEvents = listener();
    const player = { listener: events, render: () => [host], playdata: () => null };
    const document = { createElement: () => fakeElement() };
    const context = { Lampa: { Player: player, PlayerVideo: { listener: videoEvents } }, document, setTimeout, clearTimeout, Promise };
    vm.runInNewContext(await readFile(bundlePath, 'utf8'), context);
    return { api: context.EnglishLearning, events, videoEvents, host };
}

const track = { index: 1, label: 'EN', url: 'https://example.invalid/subs.vtt' };
const source = 'WEBVTT\n\n1\n00:00:01.000 --> 00:00:03.000\nHello';

test('captures exact ready payload tracks and parses injected successful loads', async () => {
    const { api, events } = await setup();
    const time = listener();
    api.configure({ enabled: true, transport: () => Promise.resolve(source), timeSource: time });
    events.send('create', { data: { subtitles: [track] }, abort() {} });
    events.send('ready', { subtitles: [track] });
    await new Promise((resolve) => setImmediate(resolve));
    time.send('ignored', 2); // The injected boundary does not presume an event name.
    // faithful test source invokes its registered callback directly through follow.
    assert.equal(api.getState().prototype.tracks, 1);
    assert.equal(api.getState().prototype.loaded, 1);
    assert.equal(api.getState().prototype.session, true);
    assert.equal(events.count('create'), 1);
});

test('injected time source updates current cue without a Player time getter', async () => {
    const { api, events } = await setup();
    let callback;
    const time = { follow(fn) { callback = fn; }, remove(fn) { if (callback === fn) callback = null; } };
    api.configure({ enabled: true, transport: () => Promise.resolve(source), timeSource: time });
    events.send('ready', { subtitles: [track] });
    await new Promise((resolve) => setImmediate(resolve));
    callback(2);
    assert.equal(api.getState().prototype.session, true);
    assert.equal(api.getState().prototype.cueId, '1');
});

test('public PlayerVideo timeupdate is the default time source and is removed only on plugin unload', async () => {
    const { api, events, videoEvents } = await setup();
    api.configure({ enabled: true, transport: () => Promise.resolve(source) });
    events.send('ready', { subtitles: [track] });
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(videoEvents.count('timeupdate'), 1);
    videoEvents.send('timeupdate', { duration: 20, current: 2 });
    assert.equal(api.getState().prototype.cueId, '1');
    events.send('destroy', {});
    assert.equal(videoEvents.count('timeupdate'), 1);
    api.destroy();
    assert.equal(videoEvents.count('timeupdate'), 0);
});

test('failure, malformed subtitles, stale sessions, external player and destroy degrade quietly', async () => {
    const { api, events } = await setup();
    let firstResolve;
    api.configure({ enabled: true, transport: () => new Promise((resolve) => { firstResolve = resolve; }) });
    events.send('ready', { subtitles: [track] });
    events.send('create', { data: { subtitles: [] }, abort() {} });
    events.send('ready', { subtitles: [] });
    firstResolve(source);
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(api.getState().prototype.tracks, 0);
    assert.equal(api.getState().prototype.loaded, 0);
    assert.equal(api.getState().prototype.errors, 0);
    events.send('external', { external: true });
    assert.equal(api.getState().prototype.session, false);
    api.destroy();
    assert.equal(events.count('create'), 0);
    assert.equal(events.count('external'), 0);
});

test('rejected, empty and malformed loader responses stay contained in diagnostics state', async () => {
    const { api, events } = await setup();
    const responses = [Promise.reject(new Error('network')), Promise.resolve(''), Promise.resolve('not a subtitle')];
    api.configure({ enabled: true, transport: () => responses.shift() });
    events.send('ready', { subtitles: [track, track, track] });
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(api.getState().prototype.session, true);
    assert.equal(api.getState().prototype.tracks, 3);
    assert.equal(api.getState().prototype.errors, 1);
});

test('diagnostic is opt-in, noninteractive and only visible while confirmed controls class is visible', async () => {
    const { api, events, host } = await setup();
    events.send('ready', { subtitles: [] });
    assert.equal(host.children.length, 0);
    api.configure({ diagnostics: true });
    assert.equal(host.children.length, 1);
    assert.equal(host.children[0].hidden, true);
    host.classList.add('player--panel-visible');
    api.configure({ diagnostics: true });
    assert.equal(host.children[0].hidden, false);
    assert.match(host.children[0].style.cssText, /pointer-events:none/);
    api.configure({ diagnostics: false });
    assert.equal(host.children.length, 0);
});

test('ten Player destroy cycles preserve shell listeners until explicit plugin unload', async () => {
    const { api, events, videoEvents, host } = await setup();
    api.configure({ enabled: true, diagnostics: true, transport: () => Promise.resolve(source) });
    for (let i = 0; i < 10; i += 1) {
        events.send('create', { data: { subtitles: [track] }, abort() {} });
        events.send('ready', { subtitles: [track] });
        assert.equal(api.getState().prototype.session, true);
        events.send('destroy', {});
        assert.equal(api.getState().prototype.session, false);
        assert.equal(events.count('ready'), 1);
        assert.equal(events.count('destroy'), 1);
        assert.equal(events.count('create'), 1);
        assert.equal(events.count('external'), 1);
        assert.equal(videoEvents.count('timeupdate'), 1);
    }
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(host.children.length, 0);
    api.destroy();
    assert.equal(events.count('ready'), 0);
    assert.equal(events.count('destroy'), 0);
    assert.equal(events.count('create'), 0);
    assert.equal(events.count('external'), 0);
    assert.equal(videoEvents.count('timeupdate'), 0);
});
