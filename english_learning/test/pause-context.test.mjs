/* SPDX-License-Identifier: GPL-2.0-only */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const bundle = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', 'english_learning.js');
function element(width = 1920, height = 1080) { const classes = new Set(); return { children: [], style: {}, textContent: '', parentNode: null, clientWidth: width, clientHeight: height, classList: { contains: (name) => classes.has(name), add: (name) => classes.add(name), remove: (name) => classes.delete(name) }, setAttribute(name, value) { this[name] = value; }, appendChild(node) { node.parentNode = this; this.children.push(node); }, removeChild(node) { const at = this.children.indexOf(node); if (at >= 0) this.children.splice(at, 1); node.parentNode = null; } }; }
function listener() { const map = {}; return { follow(name, fn) { (map[name] || (map[name] = [])).push(fn); }, remove(name, fn) { const list = map[name] || [], at = list.indexOf(fn); if (at >= 0) list.splice(at, 1); }, send(name, data) { (map[name] || []).slice().forEach((fn) => fn(data)); }, count(name) { return (map[name] || []).length; } }; }
async function loadContext(options = {}) { const host = element(options.width, options.height), playerEvents = listener(), videoEvents = listener(), store = options.store || {}; const context = { Lampa: { Player: { listener: playerEvents, render: () => [host], playdata: () => null }, PlayerVideo: { listener: videoEvents }, Storage: { get: (key, fallback) => store[key] === undefined ? fallback : store[key], set: (key, value) => { store[key] = value; }, field: (key) => store.__fields && store.__fields[key] } }, document: { createElement: () => element() }, MutationObserver: options.MutationObserver, Promise, setTimeout, clearTimeout }; vm.runInNewContext(await readFile(bundle, 'utf8'), context); return { context, api: context.EnglishLearning, host, playerEvents, videoEvents, store }; }
function cue(id, start, end, text) { return { id, start, end, text }; }

test('history boundaries, newest-four order, long timestamps and source immutability are deterministic', async () => {
  const { api } = await loadContext();
  const english = [cue('old', 9999, 11000, 'old'), cue('edge', 10000, 12000, 'edge'), cue('a', 50000, 52000, 'a'), cue('b', 60000, 62000, 'b'), cue('c', 70000, 72000, 'c'), cue('d', 80000, 82000, 'd'), cue('now', 100000, 102000, 'now'), cue('long', 3661000, 3662000, 'long')];
  const snapshot = JSON.stringify(english);
  const result = api.ContextHistoryBuilder.build({ englishCues: english, anchorMs: 100000, windowMs: 90000, graceMs: 2500, maxItems: 4 });
  assert.equal(result.current.english, 'now'); assert.equal(result.current.grace, false); assert.deepEqual(Array.from(result.items, (x) => x.english), ['a', 'b', 'c', 'd']); assert.equal(result.windowStartMs, 10000); assert.equal(JSON.stringify(english), snapshot);
  assert.equal(api.ContextHistoryBuilder.formatTime(3661000), '61:01');
  const inclusive = api.ContextHistoryBuilder.build({ englishCues: [cue('edge', 10000, 12000, 'edge')], anchorMs: 100000, windowMs: 90000, graceMs: 0 });
  assert.equal(inclusive.items[0].english, 'edge');
});

test('active end is exclusive and grace is inclusive through exactly 2500ms', async () => {
  const { api } = await loadContext(); const cues = [cue('x', 1000, 3000, 'current')];
  assert.equal(api.ContextHistoryBuilder.build({ englishCues: cues, anchorMs: 2999 }).current.grace, false);
  assert.equal(api.ContextHistoryBuilder.build({ englishCues: cues, anchorMs: 3000 }).current.grace, true);
  assert.equal(api.ContextHistoryBuilder.build({ englishCues: cues, anchorMs: 5500 }).current.grace, true);
  assert.equal(api.ContextHistoryBuilder.build({ englishCues: cues, anchorMs: 5501 }).current, null);
});

test('offset matching, missing Russian, adjacent dedupe and XSS-shaped text remain data', async () => {
  const { api } = await loadContext();
  const evil = '<img src=x onerror=alert(1)>';
  const english = [cue('e1', 1000, 1900, evil), cue('e2', 1900, 2800, 'continued'), cue('e3', 4000, 5000, 'missing'), cue('current', 8000, 9000, 'current')];
  const russian = [cue('r1', 2400, 4300, 'Перевод')];
  const result = api.ContextHistoryBuilder.build({ englishCues: english, russianCues: russian, englishOffsetMs: 1000, russianOffsetMs: 0, anchorMs: 9000, graceMs: 0 });
  assert.equal(result.current.english, 'current'); assert.equal(result.items.length, 2); assert.equal(result.items[0].english, evil + ' continued'); assert.equal(result.items[0].russian, 'Перевод'); assert.deepEqual(Array.from(result.items[0].englishCueIds), ['e1', 'e2']); assert.equal(result.items[0].timestamp, '00:02'); assert.equal(result.items[1].russian, '');
});

test('pause controller uses only paired public events and coalesces meaningful paused seeks', async () => {
  const events = listener(), timers = [], calls = []; const root = { Lampa: { PlayerVideo: { listener: events } }, setTimeout(fn) { timers.push(fn); return timers.length; }, clearTimeout() {} };
  const Controller = (await loadContext()).api.PauseContextController; const controller = new Controller(root, { onPause: (x) => calls.push(['pause', x]), onSeek: (x) => calls.push(['seek', x]), onPlay: () => calls.push(['play']), onClear: () => calls.push(['clear']) });
  assert.equal(controller.start(), true); assert.equal(events.count('timeupdate'), 1); assert.equal(events.count('pause'), 1); assert.equal(events.count('play'), 1);
  events.send('timeupdate', { current: 10 }); assert.deepEqual(calls, []); events.send('pause', {}); assert.deepEqual(calls, [['pause', 10000]]); events.send('pause', {}); assert.equal(calls.length, 1);
  events.send('timeupdate', { current: 10.1 }); assert.equal(timers.length, 0); events.send('timeupdate', { current: 11 }); events.send('timeupdate', { current: 12 }); assert.equal(timers.length, 1); timers.shift()(); assert.deepEqual(calls.at(-1), ['seek', 12000]);
  events.send('play', {}); assert.deepEqual(calls.at(-1), ['play']); events.send('timeupdate', { current: 20 }); assert.deepEqual(calls.at(-1), ['play']); controller.reset(); assert.deepEqual(calls.at(-1), ['clear']); controller.stop(); assert.equal(events.count('timeupdate'), 0); assert.equal(events.count('pause'), 0); assert.equal(events.count('play'), 0);
});

test('pause controller fails closed for absent or throwing public listener contracts', async () => {
  const Controller = (await loadContext()).api.PauseContextController;
  assert.equal(new Controller({}, {}).start(), false);
  const followed = [], removed = []; const bad = { follow(name) { followed.push(name); if (name === 'pause') throw new Error('unsupported'); }, remove(name) { removed.push(name); if (name === 'timeupdate') throw new Error('remove failure'); } };
  const controller = new Controller({ Lampa: { PlayerVideo: { listener: bad } } }, {}); assert.equal(controller.start(), false); assert.deepEqual(followed, ['timeupdate', 'pause']); assert.deepEqual(removed, ['timeupdate', 'pause', 'play']); assert.equal(controller.isPaused(), false);
});

test('pause overlay is noninteractive, uses textContent and keeps newest two on a small viewport', async () => {
  const large = await loadContext({ width: 1920, height: 1080 }); const Overlay = large.api.PauseContextOverlay; const overlay = new Overlay(large.context, large.context.Lampa.Player); const items = [1, 2, 3, 4].map((n) => ({ timestamp: '00:0' + n, english: n === 1 ? '<script>bad()</script>' : 'English ' + n, russian: 'Русский ' + n }));
  overlay.render(items, 72, true); const node = large.host.children[0]; assert.equal(node.className, 'english-learning-pause-context'); assert.equal(node['aria-hidden'], 'true'); assert.match(node.style.cssText, /pointer-events:none/); assert.equal(node.style.left, '4%'); assert.equal(node.style.top, '162px'); assert.equal(node.style.width, '46vw'); assert.equal(node.style.maxWidth, '900px'); assert.equal(node.children.length, 4); assert.equal(node.children[0].children[1].textContent, '<script>bad()</script>'); assert.equal(node.children[0].children[1].innerHTML, undefined); assert.equal(node.children[0].children[1].style.color, '#FFD166'); assert.equal(node.children[0].children[2].style.color, '#F5F5F5');
  assert.ok(162 + Number.parseInt(node.style.maxHeight, 10) <= 1080 * 0.94); assert.equal(node.children[0].children[1].style.maxHeight, '92px');
  const small = await loadContext({ width: 320, height: 180 }); const compact = new small.api.PauseContextOverlay(small.context, small.context.Lampa.Player); compact.render(items, 72, true); const compactNode = small.host.children[0]; assert.equal(compactNode.hidden, true); assert.equal(compactNode.children.length, 0); assert.equal(compactNode.style.left, '4%'); assert.equal(compactNode.style.top, '32px'); assert.equal(compactNode.style.width, '92vw'); compact.render(items, 72, false); assert.equal(compactNode.hidden, false); assert.equal(compactNode.children.length, 1); assert.equal(compactNode.children[0].children[1].textContent, 'English 4'); assert.equal(compactNode.children[0].children[1].style.fontSize, '36px'); compact.remove(); assert.equal(small.host.children.length, 0);
});

test('pause context coordinates only with its own bottom plaque and recalculates on controls mutation', async () => {
  const observers = []; function Observer(callback) { this.callback = callback; this.active = true; observers.push(this); this.observe = () => {}; this.disconnect = () => { this.active = false; }; }
  const setup = await loadContext({ width: 1920, height: 1080, MutationObserver: Observer }); const bottom = new setup.api.DualSubtitleOverlay(setup.context, setup.context.Lampa.Player); const context = new setup.api.PauseContextOverlay(setup.context, setup.context.Lampa.Player); const items = [1, 2, 3, 4].map((n) => ({ timestamp: '00:0' + n, english: 'Long previous English line ' + n, russian: 'Длинная предыдущая русская строка ' + n }));
  bottom.render(true, 'Long current English line that may wrap twice', 'Длинная текущая русская строка в две строки', true, 72, 'off'); context.render(items, 72, true, bottom); const node = context.node; let geometry = bottom.geometry(); assert.equal(node.hidden, false); assert.ok(Number.parseInt(node.style.top, 10) + Number.parseInt(node.style.maxHeight, 10) <= geometry.topPx - 12);
  const hiddenMax = Number.parseInt(node.style.maxHeight, 10); setup.host.classList.add('player--panel-visible'); observers.filter((x) => x.active).forEach((x) => x.callback()); geometry = bottom.geometry(); assert.ok(Number.parseInt(node.style.top, 10) + Number.parseInt(node.style.maxHeight, 10) <= geometry.topPx - 12); assert.ok(Number.parseInt(node.style.maxHeight, 10) < hiddenMax); assert.ok(node.children.length >= 1);
  context.remove(); assert.equal(observers.filter((x) => x.active).length, 1); bottom.remove(); assert.equal(observers.filter((x) => x.active).length, 0);
});

test('integration shows context on pause, synthetic grace in gaps, live toggle and full cleanup', async () => {
  const { api, playerEvents, videoEvents, host } = await loadContext();
  const en = 'WEBVTT\n\n1\n00:00:01.000 --> 00:00:02.000\nFirst\n\n2\n00:00:03.000 --> 00:00:04.000\nSecond\n\n3\n00:00:05.000 --> 00:00:06.000\nCurrent';
  const ru = 'WEBVTT\n\n1\n00:00:01.000 --> 00:00:02.000\nПервый\n\n2\n00:00:03.000 --> 00:00:04.000\nВторой\n\n3\n00:00:05.000 --> 00:00:06.000\nТекущий';
  api.configure({ enabled: true, transport: (url) => Promise.resolve(url === 'ru' ? ru : en) }); playerEvents.send('ready', { subtitles: [{ label: 'English', url: 'en' }, { label: 'Russian', url: 'ru' }] }); await new Promise((r) => setImmediate(r));
  videoEvents.send('timeupdate', { current: 5.5 }); const bottom = host.children.find((x) => x.className === 'english-learning-subtitles'); videoEvents.send('pause', { current: 5.5 }); const panel = host.children.find((x) => x.className === 'english-learning-pause-context'); assert.ok(panel); assert.equal(host.children.find((x) => x.className === 'english-learning-subtitles'), bottom); assert.equal(api.getState().prototype.paused, true); assert.equal(api.getState().prototype.pauseItems, 2);
  videoEvents.send('play', {}); assert.equal(host.children.some((x) => x.className === 'english-learning-pause-context'), false); videoEvents.send('pause', { current: 8.5 }); assert.equal(host.children.find((x) => x.className === 'english-learning-subtitles').children[0].children[0].textContent, 'Current');
  videoEvents.send('timeupdate', { current: 8.8 }); await new Promise((r) => setTimeout(r, 1)); assert.equal(host.children.some((x) => x.className === 'english-learning-subtitles'), false);
  api.configure({ pauseContextEnabled: false }); assert.equal(host.children.some((x) => x.className === 'english-learning-pause-context'), false); assert.equal(api.getState().prototype.settings.pauseContextEnabled, false); api.configure({ pauseContextEnabled: true }); assert.equal(host.children.some((x) => x.className === 'english-learning-pause-context'), true);
  api.configure({ enabled: false }); assert.equal(host.children.some((x) => /english-learning-(subtitles|pause-context)/.test(x.className)), false); assert.equal(api.getState().prototype.paused, false); api.destroy(); assert.equal(videoEvents.count('timeupdate'), 0); assert.equal(videoEvents.count('pause'), 0); assert.equal(videoEvents.count('play'), 0);
});

test('ten player sessions never accumulate pause listeners or context DOM', async () => {
  const { api, playerEvents, videoEvents, host } = await loadContext(); api.configure({ enabled: true, transport: () => Promise.resolve('WEBVTT\n\n1\n00:00:01.000 --> 00:00:02.000\nOne\n\n2\n00:00:03.000 --> 00:00:04.000\nTwo') });
  for (let i = 0; i < 10; i += 1) { playerEvents.send('ready', { subtitles: [{ label: 'English', url: 'en' }] }); await new Promise((r) => setImmediate(r)); videoEvents.send('timeupdate', { current: 3.5 }); videoEvents.send('pause', { current: 3.5 }); assert.equal(host.children.some((x) => x.className === 'english-learning-pause-context'), true); playerEvents.send('destroy', {}); assert.equal(host.children.some((x) => x.className === 'english-learning-pause-context'), false); assert.equal(videoEvents.count('pause'), 1); assert.equal(videoEvents.count('play'), 1); }
  api.destroy(); assert.equal(videoEvents.count('pause'), 0); assert.equal(videoEvents.count('play'), 0); assert.equal(videoEvents.count('timeupdate'), 0);
});
