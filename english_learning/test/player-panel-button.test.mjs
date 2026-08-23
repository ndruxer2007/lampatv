/* SPDX-License-Identifier: GPL-2.0-only */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const bundle = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', 'english_learning.js');
function events() { const map = {}; return { follow(name, fn) { (map[name] || (map[name] = [])).push(fn); }, remove(name, fn) { const list = map[name] || [], at = list.indexOf(fn); if (at >= 0) list.splice(at, 1); }, send(name, value) { (map[name] || []).slice().forEach((fn) => fn(value)); }, count(name) { return (map[name] || []).length; } }; }
function element(className = '') { return { className, children: [], parentNode: null, handlers: {}, onCalls: {}, offCalls: {}, attrs: {}, textContent: '', style: {}, setAttribute(name, value) { this.attrs[name] = value; }, appendChild(node) { node.parentNode = this; this.children.push(node); }, removeChild(node) { const at = this.children.indexOf(node); if (at >= 0) this.children.splice(at, 1); node.parentNode = null; } }; }
function matches(node, selector) { const classes = selector.split('.').filter(Boolean); const actual = (` ${node.className || ''} `); return classes.every((name) => actual.includes(` ${name} `)); }
function descendants(node, output = []) { (node.children || []).forEach((child) => { output.push(child); descendants(child, output); }); return output; }
function wrap(input) {
  const items = Array.isArray(input) ? input : input ? [input] : [];
  const api = { length: items.length, find(selector) { const found = []; items.forEach((item) => descendants(item).forEach((child) => { if (matches(child, selector)) found.push(child); })); return wrap(found); }, parent() { return wrap([...new Set(items.map((item) => item.parentNode).filter(Boolean))]); }, hasClass(name) { return !!items[0] && matches(items[0], `.${name}`); }, after(node) { const anchor = items[0], parent = anchor && anchor.parentNode; if (!parent) return api; const at = parent.children.indexOf(anchor); node.parentNode = parent; parent.children.splice(at + 1, 0, node); return api; }, on(name, fn) { items.forEach((item) => { item.onCalls[name] = (item.onCalls[name] || 0) + 1; (item.handlers[name] || (item.handlers[name] = [])).push(fn); }); return api; }, off(name, fn) { items.forEach((item) => { item.offCalls[name] = (item.offCalls[name] || 0) + 1; const list = item.handlers[name] || [], at = list.indexOf(fn); if (at >= 0) list.splice(at, 1); }); return api; }, trigger(name, event = {}) { items.forEach((item) => (item.handlers[name] || []).slice().forEach((fn) => fn(event))); return api; } };
  items.forEach((item, index) => { api[index] = item; }); return api;
}
function panelDom(anchorClass = 'player-panel__subs button selector') { const panel = element('player-panel'), right = element('player-panel__right player-panel__tv-visible'), group = element('player-panel__box-buttons'), anchor = element(anchorClass); panel.appendChild(right); right.appendChild(group); group.appendChild(anchor); return { panel, right, group, anchor }; }
function findButton(panel) { return descendants(panel).filter((node) => matches(node, '.english-learning-panel-button')); }
async function setup(mode = 'supported', mobile = false) {
  const playerEvents = events(), videoEvents = events(), keypadEvents = events(), store = {}, dom = panelDom(mode === 'wrong-anchor' ? 'player-panel__subs button' : undefined), subtitleCalls = [];
  const player = { listener: playerEvents, render: () => [], playdata: () => null, subtitles(value) { subtitleCalls.push(value); } };
  const lampa = { Player: player, PlayerVideo: { listener: videoEvents }, Keypad: { listener: keypadEvents }, Platform: { screen: (name) => name === 'mobile' && mobile }, Storage: { get: (key, fallback) => store[key] === undefined ? fallback : store[key], set: (key, value) => { store[key] = value; }, field: (key) => store[key] } };
  if (mode === 'supported' || mode === 'wrong-anchor' || mode === 'unbind-only') lampa.PlayerPanel = { render: () => wrap(dom.panel) };
  if (mode === 'partial') lampa.PlayerPanel = { render: () => ({ length: 1 }) };
  if (mode === 'throwing') lampa.PlayerPanel = { render() { throw new Error('panel unavailable'); } };
  const context = { Lampa: lampa, document: { createElement: (name) => element(name) }, $: (node) => { const wrapped = wrap(node); if (mode === 'unbind-only' && matches(node, '.english-learning-panel-button')) { wrapped.unbind = wrapped.off; wrapped.off = undefined; } return wrapped; }, Promise, setTimeout, clearTimeout, Date };
  const source = await readFile(bundle, 'utf8'); vm.runInNewContext(source, context);
  return { context, source, api: context.EnglishLearning, playerEvents, keypadEvents, store, dom, subtitleCalls };
}

test('missing, partial, throwing, wrong-anchor and mobile contracts fall back without a button', async () => {
  for (const mode of ['absent', 'partial', 'throwing', 'wrong-anchor', 'unbind-only']) { const current = await setup(mode); assert.equal(findButton(current.dom.panel).length, 0); current.playerEvents.send('ready', { subtitles: [] }); assert.equal(findButton(current.dom.panel).length, 0); assert.equal(current.api.getState().prototype.panelButton, false); current.api.configure({ enabled: true }); assert.equal(current.api.getState().prototype.settings.enabled, true); current.api.destroy(); }
  const mobile = await setup('supported', true); mobile.playerEvents.send('ready', { subtitles: [] }); assert.equal(findButton(mobile.dom.panel).length, 0); mobile.api.destroy();
});

test('supported contract mounts one native-focusable sibling and toggles persisted state once per event', async () => {
  const { context, api, dom, store, subtitleCalls, playerEvents } = await setup(); assert.equal(findButton(dom.panel).length, 0); playerEvents.send('ready', { subtitles: [] }); const button = findButton(dom.panel)[0];
  assert.ok(button); assert.equal(dom.group.children.indexOf(button), dom.group.children.indexOf(dom.anchor) + 1); assert.match(button.className, /\bbutton\b/); assert.match(button.className, /\bselector\b/); assert.equal(button.children[0].textContent, 'EL: Off'); assert.equal(button.attrs.title, 'English Learning: Off'); assert.equal(button.style.opacity, '0.72'); assert.equal(button.style.color, '#FFFFFF');
  const sameEvent = Object.preventExtensions({}); context.$(button).trigger('hover:enter', sameEvent).trigger('hover:enter', sameEvent); assert.equal(api.getState().prototype.settings.enabled, true); assert.equal(store.english_learning_enabled, true); assert.equal(button.children[0].textContent, 'EL: On'); assert.match(button.className, /english-learning-panel-button--active/); assert.equal(button.style.opacity, '1'); assert.equal(button.style.color, '#FFD166');
  assert.equal(button.onCalls['hover:enter'], 1); api.configure({ enabled: false }); assert.equal(button.children[0].textContent, 'EL: Off'); assert.equal(button.attrs['data-state'], 'off'); assert.equal(subtitleCalls.length, 0); api.destroy(); assert.equal(findButton(dom.panel).length, 0); assert.equal((button.handlers['hover:enter'] || []).length, 0); assert.equal(button.offCalls['hover:enter'], 1);
});

test('pinned player_panel controller proxy collects EL dynamically and leaves Back untouched', async () => {
  const current = await setup(); const { context, api, dom, playerEvents } = current; let controller = 'player_panel', collection = [], focus = 0, enterCount = 0;
  playerEvents.send('ready', { subtitles: [] });
  function togglePlayerPanel() { collection = descendants(dom.panel).filter((node) => matches(node, '.selector')); focus = 0; }
  function right() { focus = Math.min(collection.length - 1, focus + 1); }
  function enter() { enterCount += 1; context.$(collection[focus]).trigger('hover:enter', {}); }
  function back() { controller = 'player'; }
  togglePlayerPanel(); assert.equal(collection.length, 2); assert.equal(collection[0], dom.anchor); right(); assert.match(collection[focus].className, /english-learning-panel-button/); enter(); assert.equal(enterCount, 1); assert.equal(api.getState().prototype.settings.enabled, true); back(); assert.equal(controller, 'player'); assert.equal(api.getState().prototype.settings.enabled, true); api.destroy();
});

test('twenty toggles, ten sessions and panel rebuilds do not accumulate buttons or callbacks', async () => {
  const current = await setup(); const { context, api, dom, playerEvents, store, subtitleCalls } = current; assert.equal(findButton(dom.panel).length, 0); playerEvents.send('ready', { subtitles: [] }); let button = findButton(dom.panel)[0];
  for (let index = 0; index < 20; index += 1) context.$(button).trigger('hover:enter', {});
  assert.equal(api.getState().prototype.settings.enabled, false); assert.equal(store.english_learning_enabled, false); assert.equal((button.handlers['hover:enter'] || []).length, 1); assert.equal(findButton(dom.panel).length, 1);
  for (let index = 0; index < 10; index += 1) { playerEvents.send('ready', { subtitles: [{ label: 'EN', url: 'en' }] }); assert.equal(findButton(dom.panel).length, 1); button = findButton(dom.panel)[0]; assert.equal((button.handlers['hover:enter'] || []).length, 1); playerEvents.send('destroy', {}); assert.equal(findButton(dom.panel).length, 0); }
  playerEvents.send('ready', { subtitles: [] }); assert.equal(findButton(dom.panel).length, 1); const oldPanel = dom.panel, replacement = panelDom(); current.context.Lampa.PlayerPanel.render = () => wrap(replacement.panel); api.configure({ subtitleBackdrop: 'soft' }); assert.equal(findButton(oldPanel).length, 0); assert.equal(findButton(replacement.panel).length, 1); assert.equal(subtitleCalls.length, 0);
  playerEvents.send('external', {}); assert.equal(findButton(replacement.panel).length, 0); api.configure({ enabled: true }); assert.equal(findButton(replacement.panel).length, 0); playerEvents.send('ready', { subtitles: [] }); assert.equal(findButton(replacement.panel).length, 1); playerEvents.send('create', {}); assert.equal(findButton(replacement.panel).length, 0); api.destroy();
});

test('bundle re-evaluation removes the old EL binding and leaves exactly one current button', async () => {
  const current = await setup(); current.playerEvents.send('ready', { subtitles: [] }); const firstApi = current.api, firstButton = findButton(current.dom.panel)[0]; vm.runInNewContext(current.source, current.context); const secondApi = current.context.EnglishLearning;
  assert.notEqual(secondApi, firstApi); assert.equal(firstApi.getState().started, false); assert.equal((firstButton.handlers['hover:enter'] || []).length, 0); assert.equal(findButton(current.dom.panel).length, 0); current.playerEvents.send('ready', { subtitles: [] }); const buttons = findButton(current.dom.panel); assert.equal(buttons.length, 1); assert.equal((buttons[0].handlers['hover:enter'] || []).length, 1); secondApi.destroy(); assert.equal(findButton(current.dom.panel).length, 0);
});
