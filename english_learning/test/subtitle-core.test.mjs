/* SPDX-License-Identifier: GPL-2.0-only */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const directory = dirname(fileURLToPath(import.meta.url));
const root = resolve(directory, '..', '..');

async function core() {
    const source = await readFile(resolve(root, 'english_learning.js'), 'utf8');
    const context = {};
    vm.runInNewContext(source, context);
    return context.EnglishLearning;
}

test('parses BOM/CRLF SRT, cue ids and malformed blocks without throwing', async () => {
    const api = await core();
    const cues = api.SubtitleParser.parse('\uFEFFalpha\r\n00:00:01,2 --> 00:00:03,045\r\nOne\r\nline\r\n\r\nbroken\r\nno timing\r\n\r\n2\r\n00:00:04.000 --> 00:00:05.000\r\nTwo');
    assert.deepEqual(Array.from(cues, (cue) => [cue.id, cue.start, cue.end, cue.text]), [
        ['alpha', 1200, 3045, 'One line'], ['2', 4000, 5000, 'Two']
    ]);
});

test('parses WebVTT and safely skips header, NOTE, STYLE and REGION blocks', async () => {
    const api = await core();
    const cues = api.SubtitleParser.parse('WEBVTT\n\nNOTE private note\nignored\n\nSTYLE\n::cue { color: red; }\n\nREGION\nid:bottom\n\nvoice-7\n00:00:01.000 --> 00:00:02.000 align:start\n<c.green>Hello</c>');
    assert.deepEqual(Array.from(cues, (cue) => ({ id: cue.id, start: cue.start, end: cue.end, text: cue.text })), [{ id: 'voice-7', start: 1000, end: 2000, text: 'Hello' }]);
});

test('normalizer yields plain strings and never preserves subtitle markup', async () => {
    const api = await core();
    const text = api.SubtitleNormalizer.plainText('<img src=x onerror=alert(1)>Hi &amp; &lt;script&gt;\n <b>there</b>');
    assert.equal(text, 'Hi & <script> there');
    assert.equal(api.SubtitleNormalizer.normalizeCue({ start: 'bad', end: '00:00:02.000', text: 'x' }, 0), null);
});

test('timeline follows time across seeks, offsets, and deterministic overlaps', async () => {
    const api = await core();
    const timeline = new api.CueTimeline([
        { id: 'late', start: 1500, end: 3000, text: 'late' },
        { id: 'early', start: 1000, end: 2000, text: 'early' }
    ]);
    assert.equal(timeline.getPrimary(1600).id, 'early');
    assert.deepEqual(Array.from(timeline.getActive(1600), (cue) => cue.id), ['early', 'late']);
    assert.equal(timeline.getPrimary(2600).id, 'late');
    assert.equal(timeline.getPrimary(900), null);
    timeline.setOffset(500);
    assert.equal(timeline.getPrimary(1500).id, 'early');
    assert.equal(timeline.getPrimary(1300), null);
});

test('timeline handles a long synthetic movie with binary-search lookup', async () => {
    const api = await core();
    const cues = [];
    for (let i = 0; i < 20000; i += 1) cues.push({ id: String(i), start: i * 2000, end: i * 2000 + 1000, text: 'cue' });
    const timeline = new api.CueTimeline(cues);
    assert.equal(timeline.getPrimary(39998500).id, '19999');
    assert.equal(timeline.getPrimary(39997000), null);
});

test('aligner matches tracks by overlap, supports offsets, and leaves unmatched cues', async () => {
    const api = await core();
    const english = [
        { id: 'en-1', start: 1000, end: 3000, text: 'one' },
        { id: 'en-2', start: 5000, end: 6000, text: 'two' },
        { id: 'en-3', start: 8000, end: 9000, text: 'three' }
    ];
    const russian = [
        { id: 'ru-x', start: 1200, end: 3100, text: 'один' },
        { id: 'ru-y', start: 7000, end: 7100, text: 'лишнее' },
        { id: 'ru-z', start: 8500, end: 9500, text: 'три' }
    ];
    const aligned = api.SubtitleAligner.align(english, russian);
    assert.deepEqual(Array.from(aligned, (item) => item.russian && item.russian.id), ['ru-x', null, 'ru-z']);
    assert.ok(aligned[0].score > 0.5);
    const offset = api.SubtitleAligner.align([english[1]], [{ id: 'ru-offset', start: 4500, end: 5500, text: 'два' }], { russianOffsetMs: 500 });
    assert.equal(offset[0].russian.id, 'ru-offset');
});

test('aligner permits many-to-one RU matches and breaks full ties independently of order', async () => {
    const api = await core();
    const english = [
        { id: 'en-1', start: 1000, end: 2000, text: 'one' },
        { id: 'en-2', start: 2000, end: 3000, text: 'two' }
    ];
    const longRussian = { id: 'ru-long', start: 1000, end: 3000, text: 'один два' };
    const manyToOne = api.SubtitleAligner.align(english, [longRussian]);
    assert.deepEqual(Array.from(manyToOne, (item) => item.russian && item.russian.id), ['ru-long', 'ru-long']);

    const first = { id: 'zeta', start: 900, end: 2100, text: 'first' };
    const second = { id: 'alpha', start: 900, end: 2100, text: 'second' };
    const tieInput = [{ id: 'en', start: 1000, end: 2000, text: 'one' }];
    assert.equal(api.SubtitleAligner.align(tieInput, [first, second])[0].russian.id, 'alpha');
    assert.equal(api.SubtitleAligner.align(tieInput, [second, first])[0].russian.id, 'alpha');
});
