/*!
 * English Learning for Lampa v0.1.1
 * SPDX-License-Identifier: GPL-2.0-only
 * Source: https://github.com/ndruxer2007/lampatv/tree/main/english_learning
 * Generated file. Do not edit directly.
 */
/*
 * English Learning for Lampa
 * SPDX-License-Identifier: GPL-2.0-only
 */
(function (root) {
    'use strict';

    var namespace = 'EnglishLearning';
    var state = {
        started: false,
        player: null,
        onReady: null,
        onDestroy: null,
        prototype: null
    };

    function canListen(player) {
        return !!(player && player.listener &&
            typeof player.listener.follow === 'function' &&
            typeof player.listener.remove === 'function');
    }

    function clearState() {
        state.started = false;
        state.player = null;
        state.onReady = null;
        state.onDestroy = null;
        state.prototype = null;
    }

    function destroy() {
        if (canListen(state.player)) {
            state.player.listener.remove('ready', state.onReady);
            state.player.listener.remove('destroy', state.onDestroy);
        }

        if (state.prototype && typeof state.prototype.destroy === 'function') {
            state.prototype.destroy();
        }

        clearState();
    }

    function start() {
        var player;

        if (state.started) return true;
        if (!root.Lampa || !root.Lampa.Player) return false;

        player = root.Lampa.Player;
        if (!canListen(player)) return false;

        state.player = player;
        state.prototype = root[namespace].PlayerPrototype ?
            root[namespace].PlayerPrototype.create(player, root) : null;
        state.onReady = function (data) {
            if (state.prototype && typeof state.prototype.ready === 'function') {
                state.prototype.ready(data);
            }
        };
        state.onDestroy = function () {
            if (state.prototype && typeof state.prototype.sessionDestroyed === 'function') {
                state.prototype.sessionDestroyed();
            }
        };

        player.listener.follow('ready', state.onReady);
        player.listener.follow('destroy', state.onDestroy);
        if (state.prototype && typeof state.prototype.start === 'function') {
            state.prototype.start();
        }
        state.started = true;

        return true;
    }

    function getState() {
        return {
            started: state.started,
            supported: canListen(root.Lampa && root.Lampa.Player),
            prototype: state.prototype && typeof state.prototype.getState === 'function' ?
                state.prototype.getState() : null
        };
    }

    if (root[namespace] && typeof root[namespace].destroy === 'function') {
        root[namespace].destroy();
    }

    root[namespace] = {
        start: start,
        destroy: destroy,
        getState: getState,
        configure: function (options) {
            if (!state.prototype || typeof state.prototype.configure !== 'function') return false;
            state.prototype.configure(options);
            return true;
        }
    };

/*
 * English Learning for Lampa
 * SPDX-License-Identifier: GPL-2.0-only
 *
 * Pure subtitle parsing and timing helpers. This module deliberately does not
 * read player state, create DOM nodes, or fetch subtitle URLs.
 */
    function timestampToMs(value) {
        var match;
        var hours = 0;
        var minutes;
        var seconds;
        var milliseconds;

        if (typeof value !== 'string') return null;

        match = value.replace(/^\s+|\s+$/g, '').match(/^(?:(\d{1,}):)?(\d{2}):(\d{2})[,.](\d{1,3})$/);
        if (!match) return null;

        hours = match[1] ? Number(match[1]) : 0;
        minutes = Number(match[2]);
        seconds = Number(match[3]);
        milliseconds = Number(match[4]);
        while (match[4].length < 3) {
            milliseconds *= 10;
            match[4] += '0';
        }

        if (minutes > 59 || seconds > 59) return null;
        return (((hours * 60 + minutes) * 60 + seconds) * 1000) + milliseconds;
    }

    function decodeEntity(entity) {
        var named = {
            amp: '&',
            lt: '<',
            gt: '>',
            quot: '"',
            apos: "'"
        };
        var number;

        if (named[entity]) return named[entity];
        if (entity.charAt(0) !== '#') return '&' + entity + ';';

        number = entity.charAt(1).toLowerCase() === 'x' ?
            parseInt(entity.substring(2), 16) : parseInt(entity.substring(1), 10);
        if (isNaN(number) || number < 0 || number > 65535) return '&' + entity + ';';
        return String.fromCharCode(number);
    }

    function plainText(value) {
        var lines;
        var output = [];
        var i;
        var line;

        if (typeof value !== 'string') return '';
        lines = value.replace(/\r\n?/g, '\n').split('\n');
        for (i = 0; i < lines.length; i++) {
            /* Strip actual subtitle markup before decoding entities. Decoded
             * '<tag>' remains ordinary text for a future textContent sink. */
            line = lines[i].replace(/<[^>]*>/g, '');
            line = line.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, function (all, entity) {
                return decodeEntity(entity.toLowerCase());
            });
            line = line.replace(/^\s+|\s+$/g, '');
            if (line) output.push(line);
        }
        return output.join(' ');
    }

    function normalizeCue(cue, index) {
        var start = timestampToMs(cue && cue.start);
        var end = timestampToMs(cue && cue.end);
        var text = plainText(cue && cue.text);

        if (start === null || end === null || end <= start || !text) return null;
        return {
            id: cue.id === undefined || cue.id === null || cue.id === '' ? String(index + 1) : String(cue.id),
            start: start,
            end: end,
            text: text
        };
    }

    function parseTiming(line) {
        var match = line.match(/^\s*(\S+)\s+-->\s+(\S+)(?:\s+.*)?$/);
        if (!match) return null;
        return { start: match[1], end: match[2] };
    }

    function parseSubtitle(source) {
        var blocks;
        var cues = [];
        var i;
        var lines;
        var timingIndex;
        var timing;
        var cue;
        var first;

        if (typeof source !== 'string') return cues;
        source = source.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
        blocks = source.split(/\n{2,}/);
        for (i = 0; i < blocks.length; i++) {
            lines = blocks[i].split('\n');
            first = (lines[0] || '').replace(/^\s+|\s+$/g, '');
            if (!first || /^WEBVTT(?:\s|$)/.test(first) || /^(NOTE|STYLE|REGION)(?:\s|$)/.test(first)) continue;

            timingIndex = parseTiming(lines[0]) ? 0 : 1;
            timing = parseTiming(lines[timingIndex] || '');
            if (!timing || timingIndex + 1 >= lines.length) continue;

            cue = normalizeCue({
                id: timingIndex === 0 ? '' : lines[0],
                start: timing.start,
                end: timing.end,
                text: lines.slice(timingIndex + 1).join('\n')
            }, cues.length);
            if (cue) cues.push(cue);
        }
        return cues;
    }

    function CueTimeline(cues, offsetMs) {
        var maximumEnd = 0;
        var i;
        this.cues = (cues || []).slice().sort(function (left, right) {
            return left.start - right.start || left.end - right.end || String(left.id).localeCompare(String(right.id));
        });
        this.maximumEnd = [];
        for (i = 0; i < this.cues.length; i++) {
            maximumEnd = Math.max(maximumEnd, this.cues[i].end);
            this.maximumEnd.push(maximumEnd);
        }
        this.offsetMs = Number(offsetMs) || 0;
    }

    CueTimeline.prototype.setOffset = function (offsetMs) {
        this.offsetMs = Number(offsetMs) || 0;
    };

    CueTimeline.prototype.getActive = function (timeMs) {
        var time = Number(timeMs) - this.offsetMs;
        var low = 0;
        var high = this.cues.length;
        var middle;
        var index;
        var active = [];

        if (isNaN(time)) return active;
        while (low < high) {
            middle = Math.floor((low + high) / 2);
            if (this.cues[middle].start <= time) low = middle + 1;
            else high = middle;
        }
        index = low - 1;
        while (index >= 0 && this.maximumEnd[index] > time) {
            if (this.cues[index].start <= time) active.push(this.cues[index]);
            index -= 1;
        }
        return active.sort(function (left, right) {
            return left.start - right.start || left.end - right.end || String(left.id).localeCompare(String(right.id));
        });
    };

    CueTimeline.prototype.getPrimary = function (timeMs) {
        var active = this.getActive(timeMs);
        return active.length ? active[0] : null;
    };

    function shifted(cue, offset) {
        return { start: cue.start + offset, end: cue.end + offset };
    }

    function alignmentScore(english, russian) {
        var overlap = Math.min(english.end, russian.end) - Math.max(english.start, russian.start);
        var shortest = Math.min(english.end - english.start, russian.end - russian.start);
        return overlap > 0 && shortest > 0 ? overlap / shortest : 0;
    }

    function isBetterMatch(candidate, best) {
        if (!best || candidate.score !== best.score) return !best || candidate.score > best.score;
        if (candidate.startDistance !== best.startDistance) return candidate.startDistance < best.startDistance;
        if (candidate.start !== best.start) return candidate.start < best.start;
        if (candidate.end !== best.end) return candidate.end < best.end;
        return String(candidate.id) < String(best.id);
    }

    function alignCues(englishCues, russianCues, options) {
        var settings = options || {};
        var englishOffset = Number(settings.englishOffsetMs) || 0;
        var russianOffset = Number(settings.russianOffsetMs) || 0;
        var threshold = settings.threshold === undefined ? 0.5 : Number(settings.threshold);
        var result = [];
        var i;
        var j;
        var best;
        var score;
        var startDistance;
        var english;
        var russian;

        if (isNaN(threshold) || threshold < 0) threshold = 0.5;
        englishCues = englishCues || [];
        russianCues = russianCues || [];
        for (i = 0; i < englishCues.length; i++) {
            english = shifted(englishCues[i], englishOffset);
            best = null;
            for (j = 0; j < russianCues.length; j++) {
                russian = shifted(russianCues[j], russianOffset);
                score = alignmentScore(english, russian);
                startDistance = Math.abs(english.start - russian.start);
                if (score >= threshold && isBetterMatch({
                    index: j,
                    score: score,
                    startDistance: startDistance,
                    start: russian.start,
                    end: russian.end,
                    id: russianCues[j].id
                }, best)) {
                    best = {
                        index: j,
                        score: score,
                        startDistance: startDistance,
                        start: russian.start,
                        end: russian.end,
                        id: russianCues[j].id
                    };
                }
            }
            result.push({
                english: englishCues[i],
                russian: best ? russianCues[best.index] : null,
                score: best ? best.score : 0
            });
        }
        return result;
    }

    root[namespace].SubtitleParser = { parse: parseSubtitle, timestampToMs: timestampToMs };
    root[namespace].SubtitleNormalizer = { plainText: plainText, normalizeCue: normalizeCue };
    root[namespace].CueTimeline = CueTimeline;
    root[namespace].SubtitleAligner = { align: alignCues, score: alignmentScore };

/* SPDX-License-Identifier: GPL-2.0-only */
    function LearningSettings(root) {
        this.root = root;
        this.key = 'english_learning_preferences';
        this.values = this.defaults();
        this.read();
        this.installUi();
    }
    LearningSettings.prototype.defaults = function () {
        return { enabled: false, showRussian: true, englishOffsetMs: 0, russianOffsetMs: 0, diagnostics: false, repeatEnabled: true, repeatLeadInMs: 300, englishTrack: null, russianTrack: null };
    };
    LearningSettings.prototype.number = function (value) {
        value = Number(value);
        if (!isFinite(value)) return 0;
        return Math.max(-30000, Math.min(30000, Math.round(value)));
    };
    LearningSettings.prototype.choice = function (value) {
        if (!value || (typeof value.index !== 'number' && typeof value.label !== 'string')) return null;
        return typeof value.index === 'number' ? { index: value.index } : { label: (value.label + '').slice(0, 160) };
    };
    LearningSettings.prototype.read = function () {
        var storage = this.root.Lampa && this.root.Lampa.Storage;
        var data, scalar = {}, value;
        if (!storage || typeof storage.get !== 'function') return;
        try { data = storage.get(this.key, {}); if (typeof data === 'string') data = JSON.parse(data); } catch (error) { data = {}; }
        this.apply(data || {}, false);
        value = this.rawField('english_learning_enabled'); if (value !== undefined) scalar.enabled = value === true || value === 'true';
        value = this.rawField('english_learning_show_russian'); if (value !== undefined) scalar.showRussian = value === true || value === 'true';
        value = this.rawField('english_learning_english_offset'); if (value !== undefined) scalar.englishOffsetMs = value;
        value = this.rawField('english_learning_russian_offset'); if (value !== undefined) scalar.russianOffsetMs = value;
        value = this.rawField('english_learning_diagnostics'); if (value !== undefined) scalar.diagnostics = value === true || value === 'true';
        value = this.rawField('english_learning_repeat_enabled'); if (value !== undefined) scalar.repeatEnabled = value === true || value === 'true';
        value = this.rawField('english_learning_repeat_lead_in'); if (value !== undefined) scalar.repeatLeadInMs = value;
        this.apply(scalar, false);
    };
    LearningSettings.prototype.rawField = function (name) { var storage = this.root.Lampa && this.root.Lampa.Storage; try { return storage && typeof storage.field === 'function' ? storage.field(name) : undefined; } catch (error) { return undefined; } };
    LearningSettings.prototype.field = function (name, fallback) {
        var storage = this.root.Lampa && this.root.Lampa.Storage;
        var value;
        if (!storage || typeof storage.field !== 'function') return fallback;
        try { value = storage.field(name); } catch (error) { value = undefined; }
        return value === undefined || value === null || value === '' ? fallback : value;
    };
    LearningSettings.prototype.installUi = function () {
        var lampa = this.root.Lampa, api, self = this, icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M4 5.5h7a3 3 0 0 1 3 3v10H7a3 3 0 0 0-3 2z"/><path d="M20 5.5h-6v13h3a3 3 0 0 1 3 2z"/><path d="m8 14 2-5 2 5m-3.2-2h2.4"/></svg>';
        function text(key, fallback) { return lampa.Lang && typeof lampa.Lang.translate === 'function' ? (lampa.Lang.translate(key) || fallback) : fallback; }
        function changed(name, fallback) { return function (value) { if (value === undefined) value = self.field(name, fallback); if (self.root[namespace] && typeof self.root[namespace].configure === 'function') { var options = {}; options[name === 'english_learning_enabled' ? 'enabled' : name === 'english_learning_show_russian' ? 'showRussian' : name === 'english_learning_diagnostics' ? 'diagnostics' : name === 'english_learning_repeat_enabled' ? 'repeatEnabled' : name === 'english_learning_repeat_lead_in' ? 'repeatLeadInMs' : name === 'english_learning_english_offset' ? 'englishOffsetMs' : 'russianOffsetMs'] = value === 'true' || value === true ? true : value === 'false' || value === false ? false : value; self.root[namespace].configure(options); } }; }
        if (!lampa || !lampa.SettingsApi || typeof lampa.SettingsApi.addComponent !== 'function' || typeof lampa.SettingsApi.addParam !== 'function' || this.root.__englishLearningSettingsUi) return;
        this.root.__englishLearningSettingsUi = true;
        if (lampa.Lang && typeof lampa.Lang.add === 'function') lampa.Lang.add({ english_learning_title: { ru: 'Изучение английского', en: 'English Learning' }, english_learning_enabled: { ru: 'Включить субтитры', en: 'Enable learning subtitles' }, english_learning_show_russian: { ru: 'Показывать русский', en: 'Show Russian' }, english_learning_english_offset: { ru: 'Сдвиг английского', en: 'English offset' }, english_learning_russian_offset: { ru: 'Сдвиг русского', en: 'Russian offset' }, english_learning_diagnostics: { ru: 'Диагностика', en: 'Diagnostics' }, english_learning_repeat_enabled: { ru: 'Повтор фразы', en: 'Repeat current phrase' }, english_learning_repeat_lead_in: { ru: 'Начало повтора', en: 'Repeat lead-in' } });
        lampa.SettingsApi.addComponent({ component: 'english_learning', name: text('english_learning_title', 'English Learning'), icon: icon });
        function param(name, type, values, fallback, label) { lampa.SettingsApi.addParam({ component: 'english_learning', param: { name: name, type: type, values: values, 'default': fallback }, field: { name: text(label, label) }, onChange: changed(name, fallback) }); }
        param('english_learning_enabled', 'trigger', null, false, 'english_learning_enabled');
        param('english_learning_show_russian', 'trigger', null, true, 'english_learning_show_russian');
        param('english_learning_english_offset', 'select', { '-3000': '-3 s', '-1000': '-1 s', '0': '0', '1000': '+1 s', '3000': '+3 s' }, '0', 'english_learning_english_offset');
        param('english_learning_russian_offset', 'select', { '-3000': '-3 s', '-1000': '-1 s', '0': '0', '1000': '+1 s', '3000': '+3 s' }, '0', 'english_learning_russian_offset');
        param('english_learning_diagnostics', 'trigger', null, false, 'english_learning_diagnostics');
        param('english_learning_repeat_enabled', 'trigger', null, true, 'english_learning_repeat_enabled');
        param('english_learning_repeat_lead_in', 'select', { '0': '0 ms', '300': '300 ms', '1000': '1 s' }, '300', 'english_learning_repeat_lead_in');
    };
    LearningSettings.prototype.apply = function (options, persist) {
        var values = this.values;
        options = options || {};
        if (options.enabled !== undefined) values.enabled = options.enabled === true;
        if (options.showRussian !== undefined) values.showRussian = options.showRussian !== false;
        if (options.diagnostics !== undefined) values.diagnostics = options.diagnostics === true;
        if (options.repeatEnabled !== undefined) values.repeatEnabled = options.repeatEnabled !== false;
        if (options.repeatLeadInMs !== undefined) values.repeatLeadInMs = Math.max(0, Math.min(3000, Math.round(Number(options.repeatLeadInMs) || 0)));
        if (options.englishOffsetMs !== undefined) values.englishOffsetMs = this.number(options.englishOffsetMs);
        if (options.russianOffsetMs !== undefined) values.russianOffsetMs = this.number(options.russianOffsetMs);
        if (options.englishTrack !== undefined) values.englishTrack = this.choice(options.englishTrack);
        if (options.russianTrack !== undefined) values.russianTrack = this.choice(options.russianTrack);
        if (persist) this.save();
        return this.get();
    };
    LearningSettings.prototype.save = function () {
        var storage = this.root.Lampa && this.root.Lampa.Storage;
        if (!storage || typeof storage.set !== 'function') return;
        try { storage.set(this.key, this.get()); storage.set('english_learning_enabled', this.values.enabled); storage.set('english_learning_show_russian', this.values.showRussian); storage.set('english_learning_english_offset', this.values.englishOffsetMs + ''); storage.set('english_learning_russian_offset', this.values.russianOffsetMs + ''); storage.set('english_learning_diagnostics', this.values.diagnostics); storage.set('english_learning_repeat_enabled', this.values.repeatEnabled); storage.set('english_learning_repeat_lead_in', this.values.repeatLeadInMs + ''); } catch (error) {}
    };
    LearningSettings.prototype.get = function () { return JSON.parse(JSON.stringify(this.values)); };
    root[namespace].LearningSettings = LearningSettings;

/* SPDX-License-Identifier: GPL-2.0-only */
    function cleanLabel(label) { return (label || '').toLowerCase().replace(/[\[\]()_.-]+/g, ' ').replace(/\s+/g, ' ').trim(); }
    function languageScore(track, language) {
        var label = cleanLabel(track.label); var tokens = label.split(' '); var exact = language === 'en' ? ['en','eng','english'] : ['ru','rus','russian','рус','русский','русская','русские']; var score = 0; var i;
        for (i = 0; i < exact.length; i++) if (tokens.indexOf(exact[i]) >= 0) score += 100;
        if (tokens.indexOf('commentary') >= 0 || tokens.indexOf('comment') >= 0 || tokens.indexOf('dub') >= 0 || tokens.indexOf('dubbing') >= 0 || tokens.some(function (token) { return token.indexOf('озвучк') === 0; })) score -= 200;
        if (/\b(forced|sdh|cc)\b/.test(label)) score -= 5;
        return score;
    }
    function overrideTrack(tracks, choice) { var i; if (!choice) return null; for (i = 0; i < tracks.length; i++) if ((typeof choice.index === 'number' && tracks[i].index === choice.index) || (choice.label && cleanLabel(tracks[i].label) === cleanLabel(choice.label))) return tracks[i]; return null; }
    function select(tracks, language, choice, excluded) {
        var manual = overrideTrack(tracks, choice), best = null, score, i;
        if (manual && (!excluded || manual.url !== excluded.url)) return manual;
        for (i = 0; i < tracks.length; i++) { score = languageScore(tracks[i], language); if (score <= 0 || (excluded && tracks[i].url === excluded.url)) continue; if (!best || score > best.score || (score === best.score && ((tracks[i].index || i) < (best.track.index || best.i)))) best = { track: tracks[i], score: score, i: i }; }
        return best ? best.track : null;
    }
    root[namespace].TrackResolver = { resolve: function (tracks, options) { var english; tracks = tracks || []; options = options || {}; english = select(tracks, 'en', options.englishTrack); return { english: english, russian: select(tracks, 'ru', options.russianTrack, english) }; }, cleanLabel: cleanLabel };

/* SPDX-License-Identifier: GPL-2.0-only */
    function DualSubtitleOverlay(root, player) { this.root = root; this.player = player; this.node = null; this.en = null; this.ru = null; this.observer = null; }
    DualSubtitleOverlay.prototype.ensure = function () {
        var host, rendered, node, en, ru;
        if (this.node || !this.root.document || !this.root.document.createElement || !this.player || typeof this.player.render !== 'function') return;
        rendered = this.player.render(); host = rendered && rendered[0]; if (!host || !host.appendChild) return;
        node = this.root.document.createElement('div'); node.className = 'english-learning-subtitles'; node.setAttribute('aria-hidden', 'true'); node.style.cssText = 'position:absolute;left:8%;right:8%;bottom:9%;z-index:2;pointer-events:none;text-align:center;color:#fff;font:20px Arial,sans-serif;line-height:1.25;text-shadow:0 1px 3px #000;word-wrap:break-word;overflow:hidden;max-height:5em;';
        en = this.root.document.createElement('div'); en.className = 'english-learning-subtitles__english';
        ru = this.root.document.createElement('div'); ru.className = 'english-learning-subtitles__russian'; ru.style.cssText = 'margin-top:4px;color:#ddd;font-size:.82em;';
        node.appendChild(en); node.appendChild(ru); host.appendChild(node); this.node = node; this.en = en; this.ru = ru; this.updatePosition();
        if (typeof this.root.MutationObserver === 'function') { this.observer = new this.root.MutationObserver((function (self) { return function () { self.updatePosition(); }; }(this))); this.observer.observe(host, { attributes: true, attributeFilter: ['class'] }); }
    };
    DualSubtitleOverlay.prototype.updatePosition = function () { if (!this.node) return; if (this.node.parentNode && this.node.parentNode.classList && this.node.parentNode.classList.contains('player--panel-visible')) this.node.style.bottom = '18%'; else this.node.style.bottom = '9%'; };
    DualSubtitleOverlay.prototype.render = function (enabled, english, russian, showRussian) { if (!enabled || !english) { this.remove(); return; } this.ensure(); if (!this.node) return; this.node.hidden = false; this.en.textContent = english || ''; this.ru.textContent = showRussian && russian ? russian : ''; this.ru.hidden = !showRussian || !russian; this.updatePosition(); };
    DualSubtitleOverlay.prototype.remove = function () { if (this.observer) this.observer.disconnect(); this.observer = null; if (this.node && this.node.parentNode) this.node.parentNode.removeChild(this.node); this.node = this.en = this.ru = null; };
    root[namespace].DualSubtitleOverlay = DualSubtitleOverlay;

/* SPDX-License-Identifier: GPL-2.0-only */
    function isTrack(track) { return !!(track && typeof track.url === 'string' && track.url && typeof track.label === 'string'); }
    function inventory(data) { var source = data && data.subtitles, tracks = [], i; if (!source || typeof source.length !== 'number') return tracks; for (i = 0; i < source.length; i++) if (isTrack(source[i])) tracks.push({ index: source[i].index, label: source[i].label, url: source[i].url }); return tracks; }
    function defaultTransport(host, url, timeoutMs) { var controller, timer, options = {}, promise; if (typeof host.fetch !== 'function') return { promise: Promise.reject(new Error('fetch unavailable')) }; if (typeof host.AbortController === 'function') { controller = new host.AbortController(); options.signal = controller.signal; } promise = host.fetch(url, options).then(function (response) { if (!response || !response.ok) throw new Error('subtitle HTTP failure'); return response.text(); }); if (controller && timeoutMs > 0 && typeof host.setTimeout === 'function') { timer = host.setTimeout(function () { controller.abort(); }, timeoutMs); promise = promise.then(function (value) { host.clearTimeout(timer); return value; }, function (error) { host.clearTimeout(timer); throw error; }); } return { promise: promise, abort: controller ? function () { controller.abort(); } : null }; }
    function SubtitleLoader(host, transport) { this.host = host; this.transport = transport || null; }
    SubtitleLoader.prototype.load = function (track, timeoutMs) { var result; try { result = this.transport ? this.transport(track.url, timeoutMs) : defaultTransport(this.host, track.url, timeoutMs); if (result && typeof result.then === 'function') result = { promise: result }; return result && result.promise && typeof result.promise.then === 'function' ? result : { promise: Promise.reject(new Error('invalid subtitle transport')) }; } catch (error) { return { promise: Promise.reject(error) }; } };
    function Diagnostic(root, player) { this.root = root; this.player = player; this.node = null; this.enabled = false; this.observer = null; }
    Diagnostic.prototype.updateVisibility = function () { if (this.node) this.node.hidden = !this.enabled || !this.node.parentNode || !this.node.parentNode.classList || !this.node.parentNode.classList.contains('player--panel-visible'); };
    Diagnostic.prototype.render = function (text) { var host, rendered, self = this; if (!this.enabled) return this.remove(); if (!this.node && this.root.document && this.root.document.createElement && typeof this.player.render === 'function') { rendered = this.player.render(); host = rendered && rendered[0]; if (host && host.appendChild) { this.node = this.root.document.createElement('div'); this.node.className = 'english-learning-diagnostic'; this.node.setAttribute('aria-hidden','true'); this.node.style.cssText = 'position:absolute;right:1%;top:18%;z-index:1;pointer-events:none;font:12px monospace;color:#fff;'; host.appendChild(this.node); if (typeof this.root.MutationObserver === 'function') { this.observer = new this.root.MutationObserver(function () { self.updateVisibility(); }); this.observer.observe(host, { attributes: true, attributeFilter: ['class'] }); } } } if (this.node) { this.updateVisibility(); if (!this.node.hidden) this.node.textContent = text; } };
    Diagnostic.prototype.remove = function () { if (this.observer) this.observer.disconnect(); this.observer = null; if (this.node && this.node.parentNode) this.node.parentNode.removeChild(this.node); this.node = null; };
    function PlayerPrototype(player, root) { var self = this; this.player = player; this.root = root; this.settings = new root[namespace].LearningSettings(root); this.loader = new SubtitleLoader(root); this.diagnostic = new Diagnostic(root, player); this.overlay = new root[namespace].DualSubtitleOverlay(root, player); this.session = 0; this.active = null; this.loads = []; this.timeSource = null; this.onCreate = null; this.onExternal = null; this.onTime = null; this.repeat = new root[namespace].RepeatController(root, function () { return self.repeatContext(); }); this.remote = new root[namespace].RemoteController(root, this.repeat); }
    PlayerPrototype.prototype.start = function () { var self = this; this.onCreate = function () { self.clearSession(); }; this.onExternal = function () { self.clearSession(); }; this.player.listener.follow('create', this.onCreate); this.player.listener.follow('external', this.onExternal); this.setTimeSource(this.publicTimeSource()); this.remote.start(); };
    PlayerPrototype.prototype.publicTimeSource = function () { var listener = this.root.Lampa && this.root.Lampa.PlayerVideo && this.root.Lampa.PlayerVideo.listener, entries = []; if (!listener || typeof listener.follow !== 'function' || typeof listener.remove !== 'function') return null; return { follow: function (callback) { var wrapped = function (event) { if (event && typeof event.current === 'number') callback(event.current); }; entries.push({ callback: callback, wrapped: wrapped }); listener.follow('timeupdate', wrapped); }, remove: function (callback) { var i; for (i = entries.length - 1; i >= 0; i--) if (entries[i].callback === callback) { listener.remove('timeupdate', entries[i].wrapped); entries.splice(i, 1); } } }; };
    PlayerPrototype.prototype.setTimeSource = function (source) { var self = this; if (this.timeSource && this.onTime && this.timeSource.remove) this.timeSource.remove(this.onTime); this.timeSource = source && source.follow ? source : null; this.onTime = this.timeSource ? function (value) { self.time(value); } : null; if (this.timeSource) this.timeSource.follow(this.onTime); };
    PlayerPrototype.prototype.configure = function (options) { var trackChange, wasEnabled; options = options || {}; wasEnabled = this.settings.values.enabled; trackChange = options.englishTrack !== undefined || options.russianTrack !== undefined; if (typeof options.transport === 'function') this.loader = new SubtitleLoader(this.root, options.transport); if (options.timeSource !== undefined) this.setTimeSource(options.timeSource); this.settings.apply(options, true); this.diagnostic.enabled = this.settings.values.diagnostics; if (this.active && wasEnabled && !this.settings.values.enabled) { this.active.generation++; this.cancelLoads(); this.active.timelines = {}; this.active.cue = null; this.overlay.remove(); } else if (this.active && !wasEnabled && this.settings.values.enabled) { this.loadSelected(this.active); } else if (this.active && trackChange && this.settings.values.enabled) { this.cancelLoads(); this.active.generation++; this.active.timelines = {}; this.choose(this.active); this.loadSelected(this.active); } else if (this.active && trackChange) this.choose(this.active); this.refresh(); };
    PlayerPrototype.prototype.ready = function (data) { var current = data || (typeof this.player.playdata === 'function' ? this.player.playdata() : null); this.clearSession(); if (!current || current.external) return; this.active = { id: this.session, generation: 0, tracks: inventory(current), english: null, russian: null, timelines: {}, time: 0, errors: 0 }; this.choose(this.active); if (this.settings.values.enabled) this.loadSelected(this.active); this.refresh(); };
    PlayerPrototype.prototype.choose = function (active) { var chosen = root[namespace].TrackResolver.resolve(active.tracks, this.settings.values); active.english = chosen.english; active.russian = chosen.russian; };
    PlayerPrototype.prototype.loadSelected = function (active) { var self = this, selected, seen = {}, i, track, task, generation = active.generation; if (!active.english) return; selected = [active.english, active.russian]; for (i = 0; i < selected.length; i++) { track = selected[i]; if (!track || seen[track.url]) continue; seen[track.url] = true; task = this.loader.load(track, 12000); this.loads.push(task); (function (chosen, load, id, expectedGeneration) { load.promise.then(function (source) { var cues; if (!self.active || self.active.id !== id || self.active.generation !== expectedGeneration || typeof source !== 'string') return; cues = root[namespace].SubtitleParser.parse(source); if (!cues.length) { self.active.errors++; self.refresh(); return; } self.active.timelines[chosen.url] = new root[namespace].CueTimeline(cues); self.refresh(); }, function () { if (self.active && self.active.id === id && self.active.generation === expectedGeneration) { self.active.errors++; self.refresh(); } }); }(track, task, active.id, generation)); } };
    PlayerPrototype.prototype.time = function (seconds) { if (!this.active || isNaN(Number(seconds))) return; this.active.time = Number(seconds) * 1000; this.refresh(); };
    PlayerPrototype.prototype.refresh = function () { var a = this.active, en, ru, eCue, rCue, s = this.settings.values; if (!a) { this.overlay.remove(); this.diagnostic.render('English Learning: idle'); return; } eCue = a.english && a.timelines[a.english.url] ? a.timelines[a.english.url].getPrimary(a.time - s.englishOffsetMs) : null; rCue = a.russian && a.timelines[a.russian.url] ? a.timelines[a.russian.url].getPrimary(a.time - s.russianOffsetMs) : null; a.cue = eCue; en = eCue && eCue.text; ru = rCue && rCue.text; this.overlay.render(s.enabled, en, ru, s.showRussian); this.diagnostic.render('English Learning diagnostic\nselected: ' + (a.english ? 1 : 0) + '/' + (a.russian ? 1 : 0) + '\nerrors: ' + a.errors); };
    PlayerPrototype.prototype.repeatContext = function () { var a = this.active, s = this.settings.values; return { enabled:s.enabled, repeatEnabled:s.repeatEnabled, leadInMs:s.repeatLeadInMs, englishOffsetMs:s.englishOffsetMs, session:!!a, english:a&&a.english, timeline:a&&a.english&&a.timelines[a.english.url], cue:a&&a.cue }; };
    PlayerPrototype.prototype.cancelLoads = function () { var i; for (i=0;i<this.loads.length;i++) if (this.loads[i] && this.loads[i].abort) this.loads[i].abort(); this.loads=[]; };
    PlayerPrototype.prototype.clearSession = function () { this.session++; this.cancelLoads(); this.active=null; this.overlay.remove(); this.diagnostic.remove(); };
    PlayerPrototype.prototype.sessionDestroyed = function () { this.clearSession(); };
    PlayerPrototype.prototype.destroy = function () { this.clearSession(); if (this.onCreate) this.player.listener.remove('create',this.onCreate); if (this.onExternal) this.player.listener.remove('external',this.onExternal); this.setTimeSource(null); this.remote.stop(); };
    PlayerPrototype.prototype.getState = function () { return { session:!!this.active, tracks:this.active?this.active.tracks.length:0, loaded:this.active?Object.keys(this.active.timelines).length:0, errors:this.active?this.active.errors:0, cueId:this.active&&this.active.cue?this.active.cue.id:null, diagnostics:this.diagnostic.enabled, settings:this.settings.get(), english:this.active&&this.active.english?this.active.english.label:null, russian:this.active&&this.active.russian?this.active.russian.label:null }; };
    root[namespace].SubtitleLoader = SubtitleLoader;
    root[namespace].PlayerPrototype = { create:function(player,host){return new PlayerPrototype(player,host);}, inventory:inventory };

/* SPDX-License-Identifier: GPL-2.0-only */
    function RepeatController(root, context) { this.root = root; this.context = context; }
    RepeatController.prototype.repeat = function () { var state = this.context(), video, target; if (!state || !state.enabled || !state.repeatEnabled || !state.session || !state.english || !state.timeline || !state.cue) return false; video = this.root.Lampa && this.root.Lampa.PlayerVideo; if (!video || typeof video.to !== 'function') return false; target = Math.max(0, (Number(state.cue.start) + Number(state.englishOffsetMs || 0) - Number(state.leadInMs || 0)) / 1000); if (!isFinite(target)) return false; try { video.to(target); } catch (error) { return false; } return true; };
    function RemoteController(root, repeat) { this.root = root; this.repeat = repeat; this.listener = null; this.onKeydown = null; this.lastHandled = 0; }
    RemoteController.prototype.start = function () { var keypad = this.root.Lampa && this.root.Lampa.Keypad, self = this; if (this.onKeydown || !keypad || !keypad.listener || typeof keypad.listener.follow !== 'function' || typeof keypad.listener.remove !== 'function') return false; this.listener = keypad.listener; this.onKeydown = function (payload) { self.handle(payload); }; this.listener.follow('keydown', this.onKeydown); return true; };
    RemoteController.prototype.stop = function () { if (this.listener && this.onKeydown) this.listener.remove('keydown', this.onKeydown); this.listener = null; this.onKeydown = null; this.lastHandled = 0; };
    RemoteController.prototype.code = function (payload) { var event = payload && payload.event, code = payload && payload.code; if (typeof code !== 'number' && event) code = typeof event.keyCode === 'number' ? event.keyCode : event.which; return Number(code); };
    RemoteController.prototype.handle = function (payload) { var event = payload && payload.event, clock = this.root.Date && this.root.Date.now, now, handled; if (!payload || payload.enabled === false || this.code(payload) !== 403 || (event && event.repeat)) return false; now = typeof clock === 'function' ? clock() : Date.now(); if (now - this.lastHandled < 650) return false; handled = this.repeat.repeat(); if (!handled) return false; this.lastHandled = now; if (event && typeof event.preventDefault === 'function') event.preventDefault(); if (event && typeof event.stopPropagation === 'function') event.stopPropagation(); return true; };
    root[namespace].RepeatController = RepeatController;
    root[namespace].RemoteController = RemoteController;

    /* SPDX-License-Identifier: GPL-2.0-only */
    root[namespace].start();
})(typeof window !== 'undefined' ? window : this);
