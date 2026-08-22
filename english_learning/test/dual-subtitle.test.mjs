/* SPDX-License-Identifier: GPL-2.0-only */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const bundle = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', 'english_learning.js');
function element() { const classes = new Set(); return { children: [], style: {}, hidden: false, textContent: '', parentNode: null, classList: { contains: (x) => classes.has(x), add: (x) => classes.add(x) }, setAttribute() {}, appendChild(x) { x.parentNode = this; this.children.push(x); }, removeChild(x) { this.children.splice(this.children.indexOf(x), 1); x.parentNode = null; } }; }
function events() { const map = {}; return { follow(n, f) { (map[n] || (map[n] = [])).push(f); }, remove(n, f) { const a = map[n] || [], i = a.indexOf(f); if (i >= 0) a.splice(i, 1); }, send(n, x) { (map[n] || []).slice().forEach((f) => f(x)); }, count(n) { return (map[n] || []).length; } }; }
async function setup(store = {}) { const host = element(), playerEvents = events(), videoEvents = events(); const storage = { get: (k, d) => store[k] === undefined ? d : store[k], set: (k, v) => { store[k] = v; }, field: (k) => store.__fields ? store.__fields[k] : undefined }; const context = { Lampa: { Player: { listener: playerEvents, render: () => [host], playdata: () => null }, PlayerVideo: { listener: videoEvents }, Storage: storage }, document: { createElement: element }, Promise, setTimeout, clearTimeout }; vm.runInNewContext(await readFile(bundle, 'utf8'), context); return { api: context.EnglishLearning, playerEvents, videoEvents, host, store }; }
const en = 'WEBVTT\n\n1\n00:00:01.000 --> 00:00:03.000\n<img src=x onerror=1>Hello English';
const ru = 'WEBVTT\n\n1\n00:00:01.500 --> 00:00:03.500\nПривет';

test('resolver handles language aliases, forced labels, commentary and deterministic manual choice', async () => {
  const { api } = await setup();
  const tracks = [{ index: 7, label: 'English commentary', url: 'c' }, { index: 3, label: 'EN forced', url: 'e' }, { index: 4, label: 'русский SDH', url: 'r' }, { index: 1, label: 'eng', url: 'e2' }];
  const automatic = api.TrackResolver.resolve(tracks, {});
  assert.equal(automatic.english.index, 1);
  assert.equal(automatic.russian.index, 4);
  assert.equal(api.TrackResolver.resolve(tracks, { englishTrack: { index: 3 } }).english.index, 3);
  assert.equal(api.TrackResolver.resolve([{ label: 'dub russian', url: 'x' }], {}).russian, null);
});

test('settings default to disabled, clamp offsets, persist no URLs and apply toggle immediately', async () => {
  const { api, store } = await setup();
  assert.equal(api.getState().prototype.settings.enabled, false); assert.equal(api.getState().prototype.settings.subtitleFontSizePx, 28);
  api.configure({ enabled: true, englishOffsetMs: 999999, russianOffsetMs: 'bad', subtitleFontSizePx: 999, englishTrack: { label: 'English' } });
  const value = api.getState().prototype.settings;
  assert.equal(value.enabled, true); assert.equal(value.englishOffsetMs, 30000); assert.equal(value.russianOffsetMs, 0); assert.equal(value.subtitleFontSizePx, 48);
  assert.equal(store.english_learning_preferences.englishTrack.label, 'English'); assert.equal(store.english_learning_enabled, true); assert.equal(store.english_learning_english_offset, '30000'); assert.equal(store.english_learning_font_size, '48');
  assert.equal(JSON.stringify(store.english_learning_preferences).includes('url'), false);
});

test('invalid persisted preferences and scalar SettingsApi fields fall back safely', async () => {
  const broken = { english_learning_preferences: '{not json' }; const { api } = await setup(broken);
  assert.equal(api.getState().prototype.settings.enabled, false); api.configure({ englishTrack: { url: 'must-not-store' }, russianOffsetMs: Infinity, subtitleFontSizePx: 'bad' });
  assert.equal(api.getState().prototype.settings.englishTrack, null); assert.equal(api.getState().prototype.settings.russianOffsetMs, 0); assert.equal(api.getState().prototype.settings.subtitleFontSizePx, 28);
});

test('defined SettingsApi scalar fields override blob safely at startup', async () => {
  const { api } = await setup({ english_learning_preferences: { enabled: false, subtitleFontSizePx: 24 }, __fields: { english_learning_enabled: 'true', english_learning_show_russian: false, english_learning_english_offset: '999999', english_learning_russian_offset: 'bad', english_learning_font_size: '1', english_learning_diagnostics: 'true' } });
  const values = api.getState().prototype.settings; assert.equal(values.enabled, true); assert.equal(values.showRussian, false); assert.equal(values.englishOffsetMs, 30000); assert.equal(values.russianOffsetMs, 0); assert.equal(values.subtitleFontSizePx, 18); assert.equal(values.diagnostics, true);
});

test('loads only selected unique EN/RU tracks and provides EN-only or missing-EN graceful behaviour', async () => {
  const { api, playerEvents } = await setup(); const urls = [];
  api.configure({ enabled: true, transport: (url) => { urls.push(url); return Promise.resolve(url === 'ru' ? ru : en); } });
  playerEvents.send('ready', { subtitles: [{ index: 1, label: 'English', url: 'en' }, { index: 2, label: 'Русский', url: 'ru' }, { index: 3, label: 'English duplicate', url: 'en' }, { index: 4, label: 'commentary', url: 'no' }] });
  await new Promise((r) => setImmediate(r)); assert.deepEqual(urls.sort(), ['en', 'ru']);
  playerEvents.send('ready', { subtitles: [{ label: 'Russian', url: 'ru' }] }); await new Promise((r) => setImmediate(r));
  assert.equal(api.getState().prototype.english, null);
});

test('missing English does not load a Russian-only track, while EN-only loads one URL', async () => {
  const { api, playerEvents } = await setup(); const urls = [];
  api.configure({ enabled: true, transport: (url) => { urls.push(url); return Promise.resolve(en); } });
  playerEvents.send('ready', { subtitles: [{ label: 'Русская', url: 'ru' }] }); await new Promise((r) => setImmediate(r)); assert.deepEqual(urls, []);
  playerEvents.send('ready', { subtitles: [{ label: 'English', url: 'en' }] }); await new Promise((r) => setImmediate(r)); assert.deepEqual(urls, ['en']);
});

test('overlay uses textContent, follows independent offsets/showRussian and changes safe bottom with controls', async () => {
  const { api, playerEvents, videoEvents, host } = await setup();
  api.configure({ enabled: true, transport: (url) => Promise.resolve(url === 'ru' ? ru : en) });
  playerEvents.send('ready', { subtitles: [{ label: 'EN', url: 'en' }, { label: 'RU', url: 'ru' }] }); await new Promise((r) => setImmediate(r));
  videoEvents.send('timeupdate', { current: 2 });
  const overlay = host.children.find((x) => x.className === 'english-learning-subtitles');
  assert.ok(overlay); assert.equal(overlay.children[0].textContent, 'Hello English'); assert.equal(overlay.children[0].innerHTML, undefined);
  assert.equal(overlay.style.fontSize, '28px'); const sameOverlay = overlay; api.configure({ subtitleFontSizePx: 24 }); assert.equal(host.children.find((x) => x.className === 'english-learning-subtitles'), sameOverlay); assert.equal(overlay.style.fontSize, '24px'); api.configure({ subtitleFontSizePx: 40 }); assert.equal(overlay.style.fontSize, '40px');
  assert.equal(overlay.children[1].hidden, false); host.classList.add('player--panel-visible'); videoEvents.send('timeupdate', { current: 2 }); assert.equal(overlay.style.bottom, '18%');
  api.configure({ showRussian: false }); assert.equal(overlay.children[1].hidden, true);
  api.configure({ englishOffsetMs: 3000 }); videoEvents.send('timeupdate', { current: 2 }); assert.equal(host.children.some((x) => x.className === 'english-learning-subtitles'), false);
});

test('old session result is stale while current session loads, then next-session cleanup removes overlay/listeners', async () => {
  const { api, playerEvents, videoEvents, host } = await setup(); const pending = [];
  api.configure({ enabled: true, transport: (url) => new Promise((resolve) => pending.push({ url, resolve })) });
  playerEvents.send('ready', { subtitles: [{ label: 'EN', url: 'old' }] }); playerEvents.send('ready', { subtitles: [{ label: 'EN', url: 'new' }] });
  pending[0].resolve(en); await new Promise((r) => setImmediate(r)); assert.equal(api.getState().prototype.loaded, 0);
  pending[1].resolve(en); await new Promise((r) => setImmediate(r)); videoEvents.send('timeupdate', { current: 2 }); assert.equal(api.getState().prototype.loaded, 1); assert.ok(host.children.length);
  playerEvents.send('ready', { subtitles: [] }); assert.equal(host.children.length, 0); api.destroy(); assert.equal(videoEvents.count('timeupdate'), 0); assert.equal(playerEvents.count('create'), 0);
});

test('disabled ready makes no request; enable loads once; disable aborts and stale data cannot render; re-enable works', async () => {
  const { api, playerEvents, videoEvents, host } = await setup(); const pending = []; let aborted = 0;
  api.configure({ transport: (url) => { let resolve; const promise = new Promise((r) => { resolve = r; }); pending.push({ url, resolve }); return { promise, abort: () => { aborted += 1; } }; } });
  playerEvents.send('ready', { subtitles: [{ label: 'EN', url: 'en' }, { label: 'RU', url: 'ru' }] }); assert.equal(pending.length, 0);
  api.configure({ enabled: true }); assert.equal(pending.length, 2); api.configure({ enabled: true }); assert.equal(pending.length, 2);
  api.configure({ enabled: false }); assert.equal(aborted, 2); pending.forEach((x) => x.resolve(en)); await new Promise((r) => setImmediate(r)); videoEvents.send('timeupdate', { current: 2 }); assert.equal(host.children.some((x) => x.className === 'english-learning-subtitles'), false);
  api.configure({ enabled: true }); assert.equal(pending.length, 4); pending.slice(2).forEach((x) => x.resolve(x.url === 'ru' ? ru : en)); await new Promise((r) => setImmediate(r)); videoEvents.send('timeupdate', { current: 2 }); assert.ok(host.children.some((x) => x.className === 'english-learning-subtitles'));
});

test('Cyrillic commentary penalty and same-url EN/RU exclusion are deterministic', async () => {
  const { api } = await setup(); const tracks = [{ index: 1, label: 'рус озвучка', url: 'bad' }, { index: 2, label: 'Русская', url: 'ru' }, { index: 3, label: 'EN Russian', url: 'same' }];
  assert.equal(api.TrackResolver.resolve(tracks, {}).russian.index, 2);
  const same = api.TrackResolver.resolve([{ index: 1, label: 'EN RU', url: 'same' }], {}); assert.equal(same.english.index, 1); assert.equal(same.russian, null);
});

test('SettingsApi registers one namespaced component and applies onChange immediately', async () => {
  const calls = { components: [], params: [] }, storage = { field: (name) => name === 'english_learning_enabled' ? 'true' : '0', get: () => ({}), set() {} }, playerEvents = events(), videoEvents = events(), host = element();
  const context = { Lampa: { Player: { listener: playerEvents, render: () => [host] }, PlayerVideo: { listener: videoEvents }, Storage: storage, Lang: { add() {}, translate: (x) => x }, SettingsApi: { addComponent: (x) => calls.components.push(x), addParam: (x) => calls.params.push(x) } }, document: { createElement: element }, Promise, setTimeout, clearTimeout };
  vm.runInNewContext(await readFile(bundle, 'utf8'), context); assert.equal(calls.components.length, 1); assert.equal(calls.components[0].component, 'english_learning'); assert.equal(typeof calls.components[0].name, 'string'); assert.notEqual(calls.components[0].name, 'undefined'); assert.match(calls.components[0].icon, /^<svg\b/); assert.match(calls.components[0].icon, /viewBox="0 0 24 24"/); assert.match(calls.components[0].icon, /currentColor/); assert.match(calls.components[0].icon, /focusable="false"/); assert.equal(calls.components[0].icon.includes('undefined'), false); assert.equal(calls.params.length, 8); assert.equal(calls.params[0].param.name, 'english_learning_enabled'); assert.equal(calls.params[0].param.default, false); assert.equal(calls.params[1].param.default, true); assert.equal(calls.params[4].param.name, 'english_learning_font_size'); assert.equal(JSON.stringify(calls.params[4].param.values), JSON.stringify({ '24': '24 px', '28': '28 px', '32': '32 px', '36': '36 px', '40': '40 px' })); assert.equal(calls.params[4].param.default, '28'); assert.equal(calls.params[5].param.default, false); assert.equal(calls.params[6].param.default, true); assert.equal(calls.params[7].param.default, '300'); calls.params[0].onChange(); calls.params[4].onChange('40'); assert.equal(context.EnglishLearning.getState().prototype.settings.enabled, true); assert.equal(context.EnglishLearning.getState().prototype.settings.subtitleFontSizePx, 40); assert.equal(context.EnglishLearning.getState().prototype.settings.russianOffsetMs, 0);
  vm.runInNewContext(await readFile(bundle, 'utf8'), context); assert.equal(calls.components.length, 1);
});

test('absence of document quietly prevents overlay creation', async () => {
  const playerEvents = events(), videoEvents = events(), context = { Lampa: { Player: { listener: playerEvents, render: () => [] }, PlayerVideo: { listener: videoEvents }, Storage: { get: () => ({}), set() {} } }, Promise, setTimeout, clearTimeout };
  vm.runInNewContext(await readFile(bundle, 'utf8'), context); context.EnglishLearning.configure({ enabled: true, transport: () => Promise.resolve(en) }); playerEvents.send('ready', { subtitles: [{ label: 'EN', url: 'en' }] }); await new Promise((r) => setImmediate(r)); videoEvents.send('timeupdate', { current: 2 }); assert.equal(context.EnglishLearning.getState().prototype.loaded, 1);
});

test('MutationObserver changes safe bottom on controls class mutation without timeupdate', async () => {
  const host = element(), playerEvents = events(), videoEvents = events(); let notify; function Observer(callback) { notify = callback; this.observe = () => {}; this.disconnect = () => { notify = null; }; }
  const context = { Lampa: { Player: { listener: playerEvents, render: () => [host] }, PlayerVideo: { listener: videoEvents }, Storage: { get: () => ({}), set() {} } }, document: { createElement: element }, MutationObserver: Observer, Promise, setTimeout, clearTimeout };
  vm.runInNewContext(await readFile(bundle, 'utf8'), context); context.EnglishLearning.configure({ enabled: true, transport: () => Promise.resolve(en) }); playerEvents.send('ready', { subtitles: [{ label: 'EN', url: 'en' }] }); await new Promise((r) => setImmediate(r)); videoEvents.send('timeupdate', { current: 2 }); const overlay = host.children[0]; assert.equal(overlay.style.bottom, '9%'); host.classList.add('player--panel-visible'); notify(); assert.equal(overlay.style.bottom, '18%'); context.EnglishLearning.destroy(); assert.equal(notify, null);
});

test('diagnostic observer hides immediately when controls become hidden', async () => {
  const host = element(), playerEvents = events(), videoEvents = events(), observers = []; function Observer(callback) { observers.push(callback); this.observe = () => {}; this.disconnect = () => {}; }
  host.classList.add('player--panel-visible'); const context = { Lampa: { Player: { listener: playerEvents, render: () => [host] }, PlayerVideo: { listener: videoEvents }, Storage: { get: () => ({}), set() {} } }, document: { createElement: element }, MutationObserver: Observer, Promise, setTimeout, clearTimeout };
  vm.runInNewContext(await readFile(bundle, 'utf8'), context); context.EnglishLearning.configure({ diagnostics: true }); const diagnostic = host.children.find((x) => x.className === 'english-learning-diagnostic'); assert.ok(diagnostic); assert.equal(diagnostic.hidden, false); host.classList.remove = () => {}; host.classList.contains = () => false; observers.forEach((callback) => callback()); assert.equal(diagnostic.hidden, true);
});
