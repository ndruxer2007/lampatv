/* SPDX-License-Identifier: GPL-2.0-only */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const bundle = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', 'english_learning.js');
const source = '1\n00:00:00,100 --> 00:00:02,000\nHello\n';
function events() { const map = {}; return { follow(type, callback) { (map[type] || (map[type] = [])).push(callback); }, remove(type, callback) { const list = map[type] || [], index = list.indexOf(callback); if (index >= 0) list.splice(index, 1); }, send(type, data) { (map[type] || []).slice().forEach((callback) => callback(data)); }, count(type) { return (map[type] || []).length; } }; }
async function setup() { let now = 1000; const playerEvents = events(), videoEvents = events(), keypadEvents = events(), calls = [], clock = { now: () => now }; const context = { Lampa: { Player: { listener: playerEvents, render: () => [], playdata: () => null }, PlayerVideo: { listener: videoEvents, to: (seconds) => calls.push(seconds) }, Keypad: { listener: keypadEvents }, Storage: { get: () => ({}), set() {} } }, Promise, setTimeout, clearTimeout, Date: clock }; vm.runInNewContext(await readFile(bundle, 'utf8'), context); return { api: context.EnglishLearning, playerEvents, videoEvents, keypadEvents, calls, advance: (milliseconds) => { now += milliseconds; } }; }
function key(code, extra) { const result = { prevented: 0, stopped: 0, keyCode: code, preventDefault() { this.prevented += 1; }, stopPropagation() { this.stopped += 1; } }; Object.assign(result, extra); return result; }

test('red key repeats resolved English cue at clamped lead-in and consumes only handled action', async () => {
  const { api, playerEvents, videoEvents, keypadEvents, calls } = await setup(); api.configure({ enabled: true, repeatLeadInMs: 300, transport: () => Promise.resolve(source) }); playerEvents.send('ready', { subtitles: [{ label: 'EN', url: 'en' }] }); await new Promise((done) => setImmediate(done)); videoEvents.send('timeupdate', { current: 1 }); const event = key(403); keypadEvents.send('keydown', { code: 403, enabled: true, event }); assert.deepEqual(calls, [0]); assert.equal(event.prevented, 1); assert.equal(event.stopped, 1);
});

test('remote leaves unrelated, Back, Play/Pause, disabled keypad, repeat keydown and unavailable states untouched', async () => {
  const { api, playerEvents, videoEvents, keypadEvents, calls } = await setup(); const back = key(10009), playPause = key(10252), other = key(404), repeat = key(403, { repeat: true }), red = key(403), disabled = key(403); keypadEvents.send('keydown', { code: 403, event: red }); [back, playPause, other, repeat].forEach((event) => keypadEvents.send('keydown', { code: event.keyCode, event })); assert.equal(calls.length, 0); [back, playPause, other, repeat, red].forEach((event) => { assert.equal(event.prevented, 0); assert.equal(event.stopped, 0); }); api.configure({ enabled: true, transport: () => Promise.resolve(source) }); playerEvents.send('ready', { subtitles: [{ label: 'EN', url: 'en' }] }); await new Promise((done) => setImmediate(done)); videoEvents.send('timeupdate', { current: 1 }); keypadEvents.send('keydown', { code: 403, enabled: false, event: disabled }); assert.equal(calls.length, 0); assert.equal(disabled.prevented, 0); assert.equal(disabled.stopped, 0); keypadEvents.send('keydown', { event: key(403) }); assert.equal(calls.length, 1); api.configure({ enabled: false }); keypadEvents.send('keydown', { code: 403, event: key(403) }); assert.equal(calls.length, 1);
});

test('repeat uses only public PlayerVideo.to, and ten session cycles keep exactly one Keypad listener', async () => {
  const { api, playerEvents, videoEvents, keypadEvents, calls, advance } = await setup(); assert.equal(keypadEvents.count('keydown'), 1); api.configure({ enabled: true, repeatLeadInMs: 0, transport: () => Promise.resolve(source) }); for (let i = 0; i < 10; i += 1) { playerEvents.send('ready', { subtitles: [{ label: 'EN', url: 'en' }] }); await new Promise((done) => setImmediate(done)); videoEvents.send('timeupdate', { current: 1 }); advance(651); keypadEvents.send('keydown', { code: 403, event: key(403) }); assert.equal(keypadEvents.count('keydown'), 1); playerEvents.send('destroy', {}); }
  assert.equal(calls.length, 10); api.destroy(); assert.equal(keypadEvents.count('keydown'), 0);
});

test('RepeatController offsets EN cue start, clamps it, and contains missing or throwing public APIs', async () => {
  const { api } = await setup(); const calls = []; const state = { enabled: true, repeatEnabled: true, session: true, english: { url: 'en' }, timeline: {}, cue: { start: 1000 }, leadInMs: 300, englishOffsetMs: 500 }, controller = new api.RepeatController({ Lampa: { PlayerVideo: { to: (seconds) => calls.push(seconds) } } }, () => state);
  assert.equal(controller.repeat(), true); state.englishOffsetMs = -200; assert.equal(controller.repeat(), true); state.englishOffsetMs = -1000; assert.equal(controller.repeat(), true); assert.deepEqual(calls, [1.2, 0.5, 0]); assert.equal(new api.RepeatController({ Lampa: {} }, () => state).repeat(), false); assert.equal(new api.RepeatController({ Lampa: { PlayerVideo: { to() { throw new Error('no player'); } } } }, () => state).repeat(), false);
});

test('RemoteController accepts the documented event fallback and consumes it only after success', async () => {
  const { api } = await setup(); const keypad = events(), root = { Lampa: { Keypad: { listener: keypad } } }, repeat = { repeat: () => true }, remote = new api.RemoteController(root, repeat), event = key(403); assert.equal(remote.start(), true); keypad.send('keydown', { event }); assert.equal(event.prevented, 1); assert.equal(event.stopped, 1); remote.stop(); assert.equal(keypad.count('keydown'), 0);
});
