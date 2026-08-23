/*!
 * English Learning for Lampa v0.2.0
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
        return { enabled: false, showRussian: true, englishOffsetMs: 0, russianOffsetMs: 0, subtitleFontSizePx: 56, subtitleBackdrop: 'off', pauseContextEnabled: true, visualSchemaVersion: 2, diagnostics: false, repeatEnabled: true, repeatLeadInMs: 300, englishTrack: null, russianTrack: null };
    };
    LearningSettings.prototype.number = function (value) {
        value = Number(value);
        if (!isFinite(value)) return 0;
        return Math.max(-30000, Math.min(30000, Math.round(value)));
    };
    LearningSettings.prototype.fontSize = function (value, fallback) {
        value = Number(value);
        if (!isFinite(value)) return fallback;
        return Math.max(18, Math.min(72, Math.round(value)));
    };
    LearningSettings.prototype.backdrop = function (value, fallback) { return value === 'off' || value === 'soft' || value === 'contrast' ? value : fallback; };
    LearningSettings.prototype.choice = function (value) {
        if (!value || (typeof value.index !== 'number' && typeof value.label !== 'string')) return null;
        return typeof value.index === 'number' ? { index: value.index } : { label: (value.label + '').slice(0, 160) };
    };
    LearningSettings.prototype.read = function () {
        var storage = this.root.Lampa && this.root.Lampa.Storage;
        var data, scalar = {}, value, stored = false, storedFont = false;
        if (!storage || typeof storage.get !== 'function') return;
        try { data = storage.get(this.key, {}); if (typeof data === 'string') data = JSON.parse(data); } catch (error) { data = {}; }
        if (!data || typeof data !== 'object') data = {};
        stored = Object.keys(data).length > 0;
        storedFont = Object.prototype.hasOwnProperty.call(data, 'subtitleFontSizePx');
        this.apply(data || {}, false);
        value = this.rawField('english_learning_enabled'); if (value !== undefined) { stored = true; scalar.enabled = value === true || value === 'true'; }
        value = this.rawField('english_learning_show_russian'); if (value !== undefined) { stored = true; scalar.showRussian = value === true || value === 'true'; }
        value = this.rawField('english_learning_english_offset'); if (value !== undefined) { stored = true; scalar.englishOffsetMs = value; }
        value = this.rawField('english_learning_russian_offset'); if (value !== undefined) { stored = true; scalar.russianOffsetMs = value; }
        value = this.rawField('english_learning_font_size'); if (value !== undefined) { stored = true; storedFont = true; scalar.subtitleFontSizePx = value; }
        value = this.rawField('english_learning_subtitle_backdrop'); if (value !== undefined) { stored = true; scalar.subtitleBackdrop = value; }
        value = this.rawField('english_learning_pause_context'); if (value === true || value === 'true' || value === false || value === 'false') { stored = true; scalar.pauseContextEnabled = value === true || value === 'true'; }
        value = this.rawField('english_learning_diagnostics'); if (value !== undefined) { stored = true; scalar.diagnostics = value === true || value === 'true'; }
        value = this.rawField('english_learning_repeat_enabled'); if (value !== undefined) { stored = true; scalar.repeatEnabled = value === true || value === 'true'; }
        value = this.rawField('english_learning_repeat_lead_in'); if (value !== undefined) { stored = true; scalar.repeatLeadInMs = value; }
        if (stored && !storedFont) this.values.subtitleFontSizePx = 28;
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
        var lampa = this.root.Lampa, api, self = this, icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M4 5.5h7a3 3 0 0 1 3 3v10H7a3 3 0 0 0-3 2z"/><path d="M20 5.5h-6v13h3a3 3 0 0 1 3 2z"/><path d="m8 14 2-5 2 5m-3.2-2h2.4"/></svg>', settingNames = { english_learning_enabled: 'enabled', english_learning_show_russian: 'showRussian', english_learning_english_offset: 'englishOffsetMs', english_learning_russian_offset: 'russianOffsetMs', english_learning_font_size: 'subtitleFontSizePx', english_learning_subtitle_backdrop: 'subtitleBackdrop', english_learning_pause_context: 'pauseContextEnabled', english_learning_diagnostics: 'diagnostics', english_learning_repeat_enabled: 'repeatEnabled', english_learning_repeat_lead_in: 'repeatLeadInMs' };
        function text(key, fallback) { return lampa.Lang && typeof lampa.Lang.translate === 'function' ? (lampa.Lang.translate(key) || fallback) : fallback; }
        function changed(name, fallback) { return function (value) { if (value === undefined) value = self.field(name, fallback); if (self.root[namespace] && typeof self.root[namespace].configure === 'function' && settingNames[name]) { var options = {}; options[settingNames[name]] = value === 'true' || value === true ? true : value === 'false' || value === false ? false : value; self.root[namespace].configure(options); } }; }
        if (!lampa || !lampa.SettingsApi || typeof lampa.SettingsApi.addComponent !== 'function' || typeof lampa.SettingsApi.addParam !== 'function' || this.root.__englishLearningSettingsUi) return;
        this.root.__englishLearningSettingsUi = true;
        if (lampa.Lang && typeof lampa.Lang.add === 'function') lampa.Lang.add({ english_learning_title: { ru: 'Изучение английского', en: 'English Learning' }, english_learning_enabled: { ru: 'Включить субтитры', en: 'Enable learning subtitles' }, english_learning_show_russian: { ru: 'Показывать русский', en: 'Show Russian' }, english_learning_english_offset: { ru: 'Сдвиг английского', en: 'English offset' }, english_learning_russian_offset: { ru: 'Сдвиг русского', en: 'Russian offset' }, english_learning_font_size: { ru: 'Размер субтитров', en: 'Subtitle size' }, english_learning_subtitle_backdrop: { ru: 'Фон субтитров', en: 'Subtitle backdrop' }, english_learning_pause_context: { ru: 'Контекст при паузе', en: 'Show context on pause' }, english_learning_diagnostics: { ru: 'Диагностика', en: 'Diagnostics' }, english_learning_repeat_enabled: { ru: 'Повтор фразы', en: 'Repeat current phrase' }, english_learning_repeat_lead_in: { ru: 'Начало повтора', en: 'Repeat lead-in' } });
        lampa.SettingsApi.addComponent({ component: 'english_learning', name: text('english_learning_title', 'English Learning'), icon: icon });
        function param(name, type, values, fallback, label) { lampa.SettingsApi.addParam({ component: 'english_learning', param: { name: name, type: type, values: values, 'default': fallback }, field: { name: text(label, label) }, onChange: changed(name, fallback) }); }
        param('english_learning_enabled', 'trigger', null, false, 'english_learning_enabled');
        param('english_learning_show_russian', 'trigger', null, true, 'english_learning_show_russian');
        param('english_learning_english_offset', 'select', { '-3000': '-3 s', '-1000': '-1 s', '0': '0', '1000': '+1 s', '3000': '+3 s' }, '0', 'english_learning_english_offset');
        param('english_learning_russian_offset', 'select', { '-3000': '-3 s', '-1000': '-1 s', '0': '0', '1000': '+1 s', '3000': '+3 s' }, '0', 'english_learning_russian_offset');
        param('english_learning_font_size', 'select', { '24': '24 px', '28': '28 px', '32': '32 px', '40': '40 px', '48': '48 px', '56': '56 px', '64': '64 px', '72': '72 px' }, '56', 'english_learning_font_size');
        param('english_learning_subtitle_backdrop', 'select', { off: 'Off', soft: 'Soft', contrast: 'Contrast' }, 'off', 'english_learning_subtitle_backdrop');
        param('english_learning_pause_context', 'trigger', null, true, 'english_learning_pause_context');
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
        if (options.subtitleFontSizePx !== undefined) values.subtitleFontSizePx = this.fontSize(options.subtitleFontSizePx, values.subtitleFontSizePx);
        if (options.subtitleBackdrop !== undefined) values.subtitleBackdrop = this.backdrop(options.subtitleBackdrop, values.subtitleBackdrop);
        if (options.pauseContextEnabled !== undefined) values.pauseContextEnabled = options.pauseContextEnabled !== false;
        if (options.englishTrack !== undefined) values.englishTrack = this.choice(options.englishTrack);
        if (options.russianTrack !== undefined) values.russianTrack = this.choice(options.russianTrack);
        if (persist) this.save();
        return this.get();
    };
    LearningSettings.prototype.save = function () {
        var storage = this.root.Lampa && this.root.Lampa.Storage;
        if (!storage || typeof storage.set !== 'function') return;
        try { storage.set(this.key, this.get()); storage.set('english_learning_enabled', this.values.enabled); storage.set('english_learning_show_russian', this.values.showRussian); storage.set('english_learning_english_offset', this.values.englishOffsetMs + ''); storage.set('english_learning_russian_offset', this.values.russianOffsetMs + ''); storage.set('english_learning_font_size', this.values.subtitleFontSizePx + ''); storage.set('english_learning_subtitle_backdrop', this.values.subtitleBackdrop); storage.set('english_learning_pause_context', this.values.pauseContextEnabled); storage.set('english_learning_diagnostics', this.values.diagnostics); storage.set('english_learning_repeat_enabled', this.values.repeatEnabled); storage.set('english_learning_repeat_lead_in', this.values.repeatLeadInMs + ''); } catch (error) {}
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
    function finite(value, fallback) { value = Number(value); return isFinite(value) ? value : fallback; }
    function clamp(value, low, high) { return Math.max(low, Math.min(high, value)); }
    function SubtitleLayoutPolicy() {}
    SubtitleLayoutPolicy.compute = function (options) {
        var height = Math.max(0, finite(options && options.height, 0));
        var width = Math.max(0, finite(options && options.width, 0));
        var controlsVisible = !!(options && options.controlsVisible);
        var russianVisible = !!(options && options.russianVisible);
        var requested = clamp(Math.round(finite(options && options.requestedSize, 56)), 18, 72);
        var compact = height > 0 && height < 360;
        var paddingY = compact ? 4 : 12;
        var gap = russianVisible ? (compact ? 4 : 10) : 0;
        var cap = height > 0 ? Math.floor(height * (controlsVisible ? 0.36 : 0.42)) : 0;
        var factor = 1.15 + (russianVisible ? 0.72 * 1.18 : 0);
        var available = cap > 0 ? cap - paddingY * 2 - gap : 0;
        var effective = requested;
        if (cap > 0 && effective * factor > available) effective = clamp(Math.floor(available / factor), 18, requested);
        while (cap > 0 && effective > 18 && effective * 1.15 + (russianVisible ? Math.max(13, Math.round(effective * 0.72)) * 1.18 : 0) + gap + paddingY * 2 > cap) effective--;
        return {
            requestedEnglishSizePx: requested,
            effectiveEnglishSizePx: effective,
            effectiveRussianSizePx: Math.max(13, Math.round(effective * 0.72)),
            englishLineHeight: 1.15,
            russianLineHeight: 1.18,
            gapPx: gap,
            paddingYPx: paddingY,
            paddingXPx: compact ? 8 : 20,
            maxHeightPx: cap,
            maxWidthPx: width > 0 ? Math.min(1600, Math.floor(width * 0.88)) : 1600,
            bottom: controlsVisible ? '20%' : '6%'
        };
    };
    root[namespace].SubtitleLayoutPolicy = SubtitleLayoutPolicy;

/* SPDX-License-Identifier: GPL-2.0-only */
    function DualSubtitleOverlay(root, player) {
        this.root = root; this.player = player; this.node = null; this.plaque = null; this.en = null; this.ru = null; this.observer = null;
        this.requestedSize = 56; this.russianVisible = false; this.backdrop = 'off';
    }
    DualSubtitleOverlay.prototype.ensure = function () {
        var host, rendered, node, plaque, en, ru, self = this;
        if (this.node || !this.root.document || !this.root.document.createElement || !this.player || typeof this.player.render !== 'function') return;
        rendered = this.player.render(); host = rendered && rendered[0]; if (!host || !host.appendChild) return;
        node = this.root.document.createElement('div'); node.className = 'english-learning-subtitles'; node.setAttribute('aria-hidden', 'true'); node.style.cssText = 'position:absolute;left:6%;right:6%;z-index:2;pointer-events:none;text-align:center;font-family:Arial,sans-serif;word-wrap:break-word;overflow:hidden;';
        plaque = this.root.document.createElement('div'); plaque.className = 'english-learning-subtitles__plaque'; plaque.style.cssText = 'display:inline-block;box-sizing:border-box;overflow:hidden;border-radius:6px;vertical-align:bottom;';
        en = this.root.document.createElement('div'); en.className = 'english-learning-subtitles__english'; en.style.cssText = 'overflow:hidden;color:#FFD166;font-weight:600;'; en.style.color = '#FFD166'; en.style.fontWeight = '600';
        ru = this.root.document.createElement('div'); ru.className = 'english-learning-subtitles__russian'; ru.style.cssText = 'overflow:hidden;color:#F5F5F5;font-weight:400;'; ru.style.color = '#F5F5F5'; ru.style.fontWeight = '400';
        plaque.appendChild(en); plaque.appendChild(ru); node.appendChild(plaque); host.appendChild(node); this.node = node; this.plaque = plaque; this.en = en; this.ru = ru;
        if (typeof this.root.MutationObserver === 'function') { this.observer = new this.root.MutationObserver(function () { self.updateLayout(); }); this.observer.observe(host, { attributes: true, attributeFilter: ['class'] }); }
    };
    DualSubtitleOverlay.prototype.controlsVisible = function () { return !!(this.node && this.node.parentNode && this.node.parentNode.classList && this.node.parentNode.classList.contains('player--panel-visible')); };
    DualSubtitleOverlay.prototype.updateLayout = function () {
        var host, layout, shadow, background;
        if (!this.node || !this.plaque) return;
        host = this.node.parentNode;
        layout = root[namespace].SubtitleLayoutPolicy.compute({ height: host && host.clientHeight, width: host && host.clientWidth, controlsVisible: this.controlsVisible(), requestedSize: this.requestedSize, russianVisible: this.russianVisible });
        shadow = '-2px -2px 0 rgba(0,0,0,.88),2px -2px 0 rgba(0,0,0,.88),-2px 2px 0 rgba(0,0,0,.88),2px 2px 0 rgba(0,0,0,.88),0 3px 6px rgba(0,0,0,.95)';
        background = this.backdrop === 'soft' ? 'rgba(0,0,0,.42)' : this.backdrop === 'contrast' ? 'rgba(0,0,0,.68)' : 'transparent';
        this.node.style.bottom = layout.bottom; this.node.style.maxHeight = layout.maxHeightPx > 0 ? layout.maxHeightPx + 'px' : 'none';
        this.plaque.style.maxWidth = layout.maxWidthPx + 'px'; this.plaque.style.maxHeight = layout.maxHeightPx > 0 ? layout.maxHeightPx + 'px' : 'none'; this.plaque.style.padding = layout.paddingYPx + 'px ' + layout.paddingXPx + 'px'; this.plaque.style.backgroundColor = background;
        this.en.style.fontSize = layout.effectiveEnglishSizePx + 'px'; this.en.style.lineHeight = layout.englishLineHeight + ''; this.en.style.maxHeight = Math.floor(layout.effectiveEnglishSizePx * layout.englishLineHeight * 2) + 'px'; this.en.style.textShadow = shadow;
        this.ru.style.marginTop = layout.gapPx + 'px'; this.ru.style.fontSize = layout.effectiveRussianSizePx + 'px'; this.ru.style.lineHeight = layout.russianLineHeight + ''; this.ru.style.maxHeight = Math.floor(layout.effectiveRussianSizePx * layout.russianLineHeight * 2) + 'px'; this.ru.style.textShadow = shadow;
    };
    DualSubtitleOverlay.prototype.updatePosition = function () { this.updateLayout(); };
    DualSubtitleOverlay.prototype.geometry = function () {
        var host = this.node && this.node.parentNode, hostHeight = host ? Number(host.clientHeight) || 0 : 0, controls = this.controlsVisible(), layout, hostRect, plaqueRect, top, height;
        if (!this.node || !this.plaque || !host) return null;
        if (typeof host.getBoundingClientRect === 'function' && typeof this.plaque.getBoundingClientRect === 'function') {
            try { hostRect = host.getBoundingClientRect(); plaqueRect = this.plaque.getBoundingClientRect(); height = Number(plaqueRect.height); top = Number(plaqueRect.top) - Number(hostRect.top); if (isFinite(top) && isFinite(height) && height > 0) return { topPx: top, heightPx: height, measured: true, controlsVisible: controls }; } catch (error) {}
        }
        layout = root[namespace].SubtitleLayoutPolicy.compute({ height: hostHeight, width: host.clientWidth, controlsVisible: controls, requestedSize: this.requestedSize, russianVisible: this.russianVisible });
        height = layout.paddingYPx * 2 + layout.effectiveEnglishSizePx * layout.englishLineHeight * 2 + (this.russianVisible ? layout.gapPx + layout.effectiveRussianSizePx * layout.russianLineHeight * 2 : 0);
        if (layout.maxHeightPx > 0) height = Math.min(height, layout.maxHeightPx);
        top = hostHeight > 0 ? hostHeight * (1 - (controls ? 0.20 : 0.06)) - height : 0;
        return { topPx: Math.max(0, top), heightPx: height, measured: false, controlsVisible: controls };
    };
    DualSubtitleOverlay.prototype.render = function (enabled, english, russian, showRussian, fontSizePx, backdrop) {
        if (!enabled || !english) { this.remove(); return; }
        this.ensure(); if (!this.node) return;
        this.requestedSize = Number(fontSizePx); if (!isFinite(this.requestedSize)) this.requestedSize = 56; this.requestedSize = Math.max(18, Math.min(72, Math.round(this.requestedSize)));
        this.russianVisible = !!(showRussian && russian); this.backdrop = backdrop === 'soft' || backdrop === 'contrast' ? backdrop : 'off';
        this.node.hidden = false; this.en.textContent = english || ''; this.ru.textContent = this.russianVisible ? russian : ''; this.ru.hidden = !this.russianVisible; this.updateLayout();
    };
    DualSubtitleOverlay.prototype.remove = function () { if (this.observer) this.observer.disconnect(); this.observer = null; if (this.node && this.node.parentNode) this.node.parentNode.removeChild(this.node); this.node = this.plaque = this.en = this.ru = null; };
    root[namespace].DualSubtitleOverlay = DualSubtitleOverlay;

/* SPDX-License-Identifier: GPL-2.0-only */
    function PlayerPanelButtonAdapter(root, readEnabled, setEnabled) {
        this.root = root; this.readEnabled = readEnabled; this.setEnabled = setEnabled;
        this.node = null; this.label = null; this.tooltip = null; this.wrapped = null; this.panelElement = null; this.onEnter = null; this.lastEvent = null;
    }
    PlayerPanelButtonAdapter.prototype.mobile = function () {
        var platform = this.root.Lampa && this.root.Lampa.Platform;
        if (!platform || typeof platform.screen !== 'function') return true;
        try { return platform.screen('mobile') === true; } catch (error) { return true; }
    };
    PlayerPanelButtonAdapter.prototype.contract = function () {
        var lampa = this.root.Lampa, panel, right, anchor, group;
        if (!lampa || !lampa.PlayerPanel || typeof lampa.PlayerPanel.render !== 'function' || typeof this.root.$ !== 'function' || !this.root.document || typeof this.root.document.createElement !== 'function' || this.mobile()) return null;
        try {
            panel = lampa.PlayerPanel.render();
            if (!panel || typeof panel.find !== 'function' || panel.length !== 1) return null;
            right = panel.find('.player-panel__right.player-panel__tv-visible');
            if (!right || right.length !== 1 || typeof right.find !== 'function') return null;
            anchor = right.find('.player-panel__subs.button.selector');
            if (!anchor || anchor.length !== 1 || typeof anchor.parent !== 'function' || typeof anchor.after !== 'function') return null;
            group = anchor.parent();
            if (!group || group.length !== 1 || typeof group.hasClass !== 'function' || !group.hasClass('player-panel__box-buttons') || typeof group.parent !== 'function' || group.parent().length !== 1 || group.parent()[0] !== right[0]) return null;
            if (panel.find('.english-learning-panel-button').length) return null;
        } catch (error) { return null; }
        return { panel: panel, anchor: anchor };
    };
    PlayerPanelButtonAdapter.prototype.mount = function () {
        var contract, node, label, tooltip, wrapped, currentPanel, self = this;
        if (this.node && this.node.parentNode) {
            try { currentPanel = this.root.Lampa.PlayerPanel.render(); } catch (error) { currentPanel = null; }
            if (currentPanel && currentPanel.length === 1 && currentPanel[0] === this.panelElement) { this.update(); return true; }
        }
        this.remove(); contract = this.contract(); if (!contract) return false;
        try {
            node = this.root.document.createElement('div'); node.className = 'english-learning-panel-button button selector';
            label = this.root.document.createElement('span'); label.className = 'english-learning-panel-button__label';
            tooltip = this.root.document.createElement('div'); tooltip.className = 'tooltip english-learning-panel-button__tooltip';
            node.appendChild(label); node.appendChild(tooltip); wrapped = this.root.$(node);
            if (!wrapped || typeof wrapped.on !== 'function' || typeof wrapped.off !== 'function') return false;
            this.node = node; this.label = label; this.tooltip = tooltip; this.wrapped = wrapped; this.panelElement = contract.panel[0];
            this.onEnter = function (event) {
                if (event && event === self.lastEvent) return;
                self.lastEvent = event || null;
                try { self.setEnabled(!self.readEnabled()); } catch (error) { return; }
                self.update();
            };
            wrapped.on('hover:enter', this.onEnter); contract.anchor.after(node);
            if (!node.parentNode) { this.remove(); return false; }
            this.update(); return true;
        } catch (error) { this.remove(); return false; }
    };
    PlayerPanelButtonAdapter.prototype.update = function () {
        var enabled, text;
        if (!this.node || !this.label || !this.tooltip) return false;
        try { enabled = this.readEnabled() === true; } catch (error) { enabled = false; }
        text = enabled ? 'English Learning: On' : 'English Learning: Off';
        this.node.className = 'english-learning-panel-button button selector' + (enabled ? ' english-learning-panel-button--active' : '');
        this.node.setAttribute('data-state', enabled ? 'on' : 'off'); this.node.setAttribute('aria-label', text); this.node.setAttribute('title', text);
        this.node.style.color = enabled ? '#FFD166' : '#FFFFFF'; this.node.style.opacity = enabled ? '1' : '0.72';
        this.label.textContent = enabled ? 'EL: On' : 'EL: Off'; this.tooltip.textContent = text; return true;
    };
    PlayerPanelButtonAdapter.prototype.remove = function () {
        try { if (this.wrapped && this.onEnter && typeof this.wrapped.off === 'function') this.wrapped.off('hover:enter', this.onEnter); } catch (error) {}
        try { if (this.node && this.node.parentNode && typeof this.node.parentNode.removeChild === 'function') this.node.parentNode.removeChild(this.node); } catch (error) {}
        this.node = this.label = this.tooltip = this.wrapped = this.panelElement = this.onEnter = this.lastEvent = null;
    };
    PlayerPanelButtonAdapter.prototype.isMounted = function () { return !!(this.node && this.node.parentNode); };
    root[namespace].PlayerPanelButtonAdapter = PlayerPanelButtonAdapter;

/* SPDX-License-Identifier: GPL-2.0-only */
    function contextNumber(value, fallback) { value = Number(value); return isFinite(value) ? value : fallback; }
    function contextSort(left, right) { return left.start - right.start || left.end - right.end || String(left.id).localeCompare(String(right.id)); }
    function effectiveCue(cue, offset) { return { cue: cue, start: cue.start + offset, end: cue.end + offset }; }
    function formatContextTime(milliseconds) { var seconds = Math.floor(Math.max(0, milliseconds) / 1000), minutes = Math.floor(seconds / 60); seconds %= 60; return (minutes < 10 ? '0' : '') + minutes + ':' + (seconds < 10 ? '0' : '') + seconds; }
    function matchRussian(englishCue, russianCues, englishOffset, russianOffset) { var aligned = root[namespace].SubtitleAligner.align([englishCue], russianCues, { englishOffsetMs: englishOffset, russianOffsetMs: russianOffset, threshold: 0.5 }); return aligned.length ? aligned[0].russian : null; }
    function russianKey(cue) { return cue ? String(cue.id) + '|' + cue.start + '|' + cue.end + '|' + cue.text : ''; }
    function ContextHistoryBuilder() {}
    ContextHistoryBuilder.build = function (options) {
        var english = (options && options.englishCues || []).slice().sort(contextSort), russian = (options && options.russianCues || []).slice().sort(contextSort);
        var englishOffset = contextNumber(options && options.englishOffsetMs, 0), russianOffset = contextNumber(options && options.russianOffsetMs, 0), anchor = Math.max(0, contextNumber(options && options.anchorMs, 0));
        var windowMs = Math.max(0, contextNumber(options && options.windowMs, 90000)), graceMs = Math.max(0, contextNumber(options && options.graceMs, 2500)), maxItems = Math.max(0, Math.floor(contextNumber(options && options.maxItems, 4)));
        var effective = [], active = null, grace = null, candidates = [], selected, items = [], current, i, item, matched, previous, key;
        for (i = 0; i < english.length; i++) effective.push(effectiveCue(english[i], englishOffset));
        for (i = 0; i < effective.length; i++) {
            item = effective[i];
            if (!active && item.start <= anchor && item.end > anchor) active = item;
            if (item.end <= anchor && anchor - item.end <= graceMs && (!grace || item.end > grace.end || (item.end === grace.end && contextSort(item.cue, grace.cue) > 0))) grace = item;
        }
        current = active || grace;
        for (i = 0; i < effective.length; i++) {
            item = effective[i];
            if (item === current || item.end > anchor || item.start < anchor - windowMs || item.start > anchor) continue;
            candidates.push(item);
        }
        selected = maxItems ? candidates.slice(Math.max(0, candidates.length - maxItems)) : [];
        for (i = 0; i < selected.length; i++) {
            item = selected[i]; matched = matchRussian(item.cue, russian, englishOffset, russianOffset); key = russianKey(matched); previous = items.length ? items[items.length - 1] : null;
            if (matched && previous && previous.russianKey === key) {
                previous.english += ' ' + item.cue.text; previous.englishCueIds.push(String(item.cue.id)); previous.endMs = item.end;
            } else {
                items.push({ timestamp: formatContextTime(item.start), startMs: item.start, endMs: item.end, english: item.cue.text, russian: matched ? matched.text : '', englishCueIds: [String(item.cue.id)], russianKey: key });
            }
        }
        matched = current ? matchRussian(current.cue, russian, englishOffset, russianOffset) : null;
        return {
            anchorMs: anchor,
            windowStartMs: anchor - windowMs,
            current: current ? { cue: current.cue, english: current.cue.text, russian: matched ? matched.text : '', startMs: current.start, endMs: current.end, grace: !active } : null,
            items: items
        };
    };
    ContextHistoryBuilder.formatTime = formatContextTime;
    root[namespace].ContextHistoryBuilder = ContextHistoryBuilder;

/* SPDX-License-Identifier: GPL-2.0-only */
    function PauseContextController(root, callbacks) { this.root = root; this.callbacks = callbacks || {}; this.listener = null; this.onPlay = null; this.onPause = null; this.onTime = null; this.started = false; this.paused = false; this.latestTimeMs = 0; this.lastBuiltMs = null; this.pendingAnchorMs = null; this.timer = null; }
    PauseContextController.prototype.start = function () {
        var listener = this.root.Lampa && this.root.Lampa.PlayerVideo && this.root.Lampa.PlayerVideo.listener, self = this;
        if (this.started || !listener || typeof listener.follow !== 'function' || typeof listener.remove !== 'function') return false;
        this.listener = listener;
        this.onTime = function (event) { self.time(event); };
        this.onPause = function (event) { self.pause(event); };
        this.onPlay = function () { self.play(); };
        try { listener.follow('timeupdate', this.onTime); listener.follow('pause', this.onPause); listener.follow('play', this.onPlay); } catch (error) { this.stop(); return false; }
        this.started = true; return true;
    };
    PauseContextController.prototype.eventTime = function (event) { var value; if (!event || typeof event.current !== 'number') return null; value = Number(event.current); return isFinite(value) ? Math.max(0, value * 1000) : null; };
    PauseContextController.prototype.time = function (event) {
        var value = this.eventTime(event), self = this;
        if (value === null) return;
        this.latestTimeMs = value;
        if (!this.paused || (this.lastBuiltMs !== null && Math.abs(value - this.lastBuiltMs) < 250)) return;
        this.pendingAnchorMs = value;
        if (this.timer !== null) return;
        if (typeof this.root.setTimeout !== 'function') return this.flush();
        this.timer = this.root.setTimeout(function () { self.timer = null; self.flush(); }, 0);
    };
    PauseContextController.prototype.pause = function (event) {
        var value = this.eventTime(event);
        if (value !== null) this.latestTimeMs = value;
        if (this.paused && this.lastBuiltMs === this.latestTimeMs) return;
        this.cancel(); this.paused = true; this.lastBuiltMs = this.latestTimeMs;
        if (typeof this.callbacks.onPause === 'function') this.callbacks.onPause(this.latestTimeMs);
    };
    PauseContextController.prototype.play = function () { if (!this.paused) return; this.cancel(); this.paused = false; this.lastBuiltMs = null; if (typeof this.callbacks.onPlay === 'function') this.callbacks.onPlay(); };
    PauseContextController.prototype.flush = function () { var anchor = this.pendingAnchorMs; this.pendingAnchorMs = null; if (!this.paused || anchor === null || (this.lastBuiltMs !== null && Math.abs(anchor - this.lastBuiltMs) < 250)) return; this.lastBuiltMs = anchor; if (typeof this.callbacks.onSeek === 'function') this.callbacks.onSeek(anchor); };
    PauseContextController.prototype.cancel = function () { if (this.timer !== null && typeof this.root.clearTimeout === 'function') this.root.clearTimeout(this.timer); this.timer = null; this.pendingAnchorMs = null; };
    PauseContextController.prototype.reset = function () { this.cancel(); this.paused = false; this.latestTimeMs = 0; this.lastBuiltMs = null; if (typeof this.callbacks.onClear === 'function') this.callbacks.onClear(); };
    PauseContextController.prototype.stop = function () { var listener = this.listener; this.cancel(); if (listener && typeof listener.remove === 'function') { if (this.onTime) try { listener.remove('timeupdate', this.onTime); } catch (timeError) {} if (this.onPause) try { listener.remove('pause', this.onPause); } catch (pauseError) {} if (this.onPlay) try { listener.remove('play', this.onPlay); } catch (playError) {} } this.listener = this.onTime = this.onPause = this.onPlay = null; this.started = false; this.paused = false; this.latestTimeMs = 0; this.lastBuiltMs = null; };
    PauseContextController.prototype.isPaused = function () { return this.paused; };

    function PauseContextOverlay(root, player) { this.root = root; this.player = player; this.node = null; this.observer = null; this.items = []; this.requestedSize = 56; this.showRussian = true; this.bottomOverlay = null; }
    PauseContextOverlay.prototype.ensure = function () {
        var rendered, host, node, self = this;
        if (this.node || !this.root.document || typeof this.root.document.createElement !== 'function' || !this.player || typeof this.player.render !== 'function') return;
        rendered = this.player.render(); host = rendered && rendered[0]; if (!host || typeof host.appendChild !== 'function') return;
        node = this.root.document.createElement('div'); node.className = 'english-learning-pause-context'; node.setAttribute('aria-hidden', 'true'); node.style.cssText = 'position:absolute;z-index:2;box-sizing:border-box;overflow:hidden;pointer-events:none;background:rgba(0,0,0,.58);border-radius:8px;font-family:Arial,sans-serif;'; host.appendChild(node); this.node = node;
        if (typeof this.root.MutationObserver === 'function') { this.observer = new this.root.MutationObserver(function () { if (self.bottomOverlay && typeof self.bottomOverlay.updateLayout === 'function') self.bottomOverlay.updateLayout(); self.updateLayout(); }); this.observer.observe(host, { attributes: true, attributeFilter: ['class'] }); }
    };
    PauseContextOverlay.prototype.clear = function () { if (!this.node) return; while (this.node.children && this.node.children.length) this.node.removeChild(this.node.children[0]); };
    PauseContextOverlay.prototype.entryEstimate = function (item, contextSize, russianSize, showRussian, small) { return 18 + contextSize * 1.15 * 2 + (showRussian && item.russian ? 4 + russianSize * 1.18 * 2 : 0) + (small ? 6 : 12); };
    PauseContextOverlay.prototype.updateLayout = function () {
        var host = this.node && this.node.parentNode, hostHeight, small, controls, top, boundary, geometry, maxHeight, limit, candidates, visible = [], anyRussian = false, layout, contextSize, russianSize, used, i, item, entry, timestamp, english, russian, measured;
        if (!this.node || !host || !this.items.length) return;
        hostHeight = Math.max(0, Number(host.clientHeight) || 0); small = hostHeight > 0 && hostHeight < 360; controls = !!(host.classList && host.classList.contains('player--panel-visible')); top = hostHeight * (small ? 0.18 : 0.15); boundary = hostHeight > 0 ? hostHeight * (controls ? 0.80 : 0.94) : 0;
        geometry = this.bottomOverlay && typeof this.bottomOverlay.geometry === 'function' ? this.bottomOverlay.geometry() : null; if (geometry && isFinite(Number(geometry.topPx))) boundary = Math.min(boundary || Number(geometry.topPx), Number(geometry.topPx) - 12);
        maxHeight = hostHeight > 0 ? Math.max(0, Math.floor(boundary - top)) : 0; limit = small ? 2 : 4; candidates = this.items.slice(Math.max(0, this.items.length - limit));
        for (i = 0; i < candidates.length; i++) if (this.showRussian && candidates[i].russian) anyRussian = true;
        layout = root[namespace].SubtitleLayoutPolicy.compute({ height: hostHeight, width: host.clientWidth, controlsVisible: controls, requestedSize: this.requestedSize, russianVisible: anyRussian }); contextSize = Math.max(24, Math.min(40, Math.round(layout.effectiveEnglishSizePx * 0.62))); russianSize = Math.round(contextSize * 0.72);
        used = small ? 16 : 36;
        for (i = candidates.length - 1; i >= 0; i--) { item = candidates[i]; measured = this.entryEstimate(item, contextSize, russianSize, this.showRussian, small); if (used + measured <= maxHeight) { visible.unshift(item); used += measured; } else break; }
        this.node.style.left = '4%'; this.node.style.top = Math.floor(top) + 'px'; this.node.style.width = small ? '92vw' : '46vw'; this.node.style.maxWidth = small ? '92vw' : '900px'; this.node.style.maxHeight = maxHeight + 'px'; this.node.style.padding = small ? '8px' : '18px'; this.clear();
        if (!visible.length || maxHeight <= 0) { this.node.hidden = true; return; }
        this.node.hidden = false;
        for (i = 0; i < visible.length; i++) {
            item = visible[i]; entry = this.root.document.createElement('div'); entry.className = 'english-learning-pause-context__entry'; entry.style.marginTop = i ? (small ? '6px' : '12px') : '0';
            timestamp = this.root.document.createElement('div'); timestamp.className = 'english-learning-pause-context__timestamp'; timestamp.style.cssText = 'color:#B8B8B8;font-size:16px;line-height:1.1;overflow:hidden;'; timestamp.textContent = item.timestamp || '';
            english = this.root.document.createElement('div'); english.className = 'english-learning-pause-context__english'; english.style.color = '#FFD166'; english.style.fontSize = contextSize + 'px'; english.style.lineHeight = '1.15'; english.style.maxHeight = Math.floor(contextSize * 1.15 * 2) + 'px'; english.style.overflow = 'hidden'; english.textContent = item.english || '';
            entry.appendChild(timestamp); entry.appendChild(english);
            if (this.showRussian && item.russian) { russian = this.root.document.createElement('div'); russian.className = 'english-learning-pause-context__russian'; russian.style.color = '#F5F5F5'; russian.style.fontSize = russianSize + 'px'; russian.style.lineHeight = '1.18'; russian.style.maxHeight = Math.floor(russianSize * 1.18 * 2) + 'px'; russian.style.marginTop = '4px'; russian.style.overflow = 'hidden'; russian.textContent = item.russian; entry.appendChild(russian); }
            this.node.appendChild(entry);
        }
        if (Number(this.node.scrollHeight) > maxHeight || (typeof this.node.getBoundingClientRect === 'function' && Number(this.node.getBoundingClientRect().height) > maxHeight)) { while (this.node.children.length > 1 && (Number(this.node.scrollHeight) > maxHeight || Number(this.node.getBoundingClientRect && this.node.getBoundingClientRect().height) > maxHeight)) this.node.removeChild(this.node.children[0]); if (Number(this.node.scrollHeight) > maxHeight || Number(this.node.getBoundingClientRect && this.node.getBoundingClientRect().height) > maxHeight) { this.clear(); this.node.hidden = true; } }
    };
    PauseContextOverlay.prototype.render = function (items, requestedSize, showRussian, bottomOverlay) { this.items = (items || []).slice(); this.requestedSize = requestedSize; this.showRussian = showRussian !== false; this.bottomOverlay = bottomOverlay || null; if (!this.items.length) { this.remove(); return; } this.ensure(); this.updateLayout(); };
    PauseContextOverlay.prototype.remove = function () { if (this.observer) this.observer.disconnect(); this.observer = null; if (this.node && this.node.parentNode) this.node.parentNode.removeChild(this.node); this.node = null; this.items = []; this.bottomOverlay = null; };
    root[namespace].PauseContextController = PauseContextController;
    root[namespace].PauseContextOverlay = PauseContextOverlay;

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
    function PlayerPrototype(player, root) { var self = this; this.player = player; this.root = root; this.settings = new root[namespace].LearningSettings(root); this.loader = new SubtitleLoader(root); this.diagnostic = new Diagnostic(root, player); this.overlay = new root[namespace].DualSubtitleOverlay(root, player); this.pauseOverlay = new root[namespace].PauseContextOverlay(root, player); this.session = 0; this.active = null; this.loads = []; this.timeSource = null; this.onCreate = null; this.onExternal = null; this.onTime = null; this.panelButtonAllowed = false; this.repeat = new root[namespace].RepeatController(root, function () { return self.repeatContext(); }); this.remote = new root[namespace].RemoteController(root, this.repeat); this.panelButton = new root[namespace].PlayerPanelButtonAdapter(root, function () { return self.settings.values.enabled; }, function (enabled) { self.configure({ enabled: enabled }); }); this.pauseController = new root[namespace].PauseContextController(root, { onPause: function (anchor) { self.pauseAt(anchor); }, onSeek: function (anchor) { self.pauseAt(anchor); }, onPlay: function () { self.resumeFromPause(); }, onClear: function () { self.clearPauseView(); } }); }
    PlayerPrototype.prototype.start = function () { var self = this; this.onCreate = function () { self.panelButtonAllowed = false; self.clearSession(); }; this.onExternal = function () { self.panelButtonAllowed = false; self.clearSession(); }; this.player.listener.follow('create', this.onCreate); this.player.listener.follow('external', this.onExternal); this.setTimeSource(this.publicTimeSource()); this.pauseController.start(); this.remote.start(); };
    PlayerPrototype.prototype.publicTimeSource = function () { var listener = this.root.Lampa && this.root.Lampa.PlayerVideo && this.root.Lampa.PlayerVideo.listener, entries = []; if (!listener || typeof listener.follow !== 'function' || typeof listener.remove !== 'function') return null; return { follow: function (callback) { var wrapped = function (event) { if (event && typeof event.current === 'number') callback(event.current); }; entries.push({ callback: callback, wrapped: wrapped }); listener.follow('timeupdate', wrapped); }, remove: function (callback) { var i; for (i = entries.length - 1; i >= 0; i--) if (entries[i].callback === callback) { listener.remove('timeupdate', entries[i].wrapped); entries.splice(i, 1); } } }; };
    PlayerPrototype.prototype.setTimeSource = function (source) { var self = this; if (this.timeSource && this.onTime && this.timeSource.remove) this.timeSource.remove(this.onTime); this.timeSource = source && source.follow ? source : null; this.onTime = this.timeSource ? function (value) { self.time(value); } : null; if (this.timeSource) this.timeSource.follow(this.onTime); };
    PlayerPrototype.prototype.configure = function (options) { var trackChange, wasEnabled; options = options || {}; wasEnabled = this.settings.values.enabled; trackChange = options.englishTrack !== undefined || options.russianTrack !== undefined; if (typeof options.transport === 'function') this.loader = new SubtitleLoader(this.root, options.transport); if (options.timeSource !== undefined) this.setTimeSource(options.timeSource); this.settings.apply(options, true); this.diagnostic.enabled = this.settings.values.diagnostics; if (wasEnabled && !this.settings.values.enabled) { this.remote.reset(); this.pauseController.reset(); } if (this.active && wasEnabled && !this.settings.values.enabled) { this.active.generation++; this.cancelLoads(); this.active.timelines = {}; this.active.cue = null; this.overlay.remove(); this.pauseOverlay.remove(); } else if (this.active && !wasEnabled && this.settings.values.enabled) { this.loadSelected(this.active); } else if (this.active && trackChange && this.settings.values.enabled) { this.cancelLoads(); this.active.generation++; this.active.timelines = {}; this.choose(this.active); this.loadSelected(this.active); } else if (this.active && trackChange) this.choose(this.active); if (!this.settings.values.pauseContextEnabled) { this.pauseController.cancel(); this.clearPauseView(); } this.refresh(); if (this.panelButtonAllowed) this.panelButton.mount(); this.panelButton.update(); };
    PlayerPrototype.prototype.ready = function (data) { var current = data || (typeof this.player.playdata === 'function' ? this.player.playdata() : null); this.panelButtonAllowed = false; this.clearSession(); if (!current || current.external) return; this.panelButtonAllowed = true; this.active = { id: this.session, generation: 0, tracks: inventory(current), english: null, russian: null, timelines: {}, time: 0, errors: 0 }; this.choose(this.active); if (this.settings.values.enabled) this.loadSelected(this.active); this.refresh(); this.panelButton.mount(); };
    PlayerPrototype.prototype.choose = function (active) { var chosen = root[namespace].TrackResolver.resolve(active.tracks, this.settings.values); active.english = chosen.english; active.russian = chosen.russian; };
    PlayerPrototype.prototype.loadSelected = function (active) { var self = this, selected, seen = {}, i, track, task, generation = active.generation; if (!active.english) return; selected = [active.english, active.russian]; for (i = 0; i < selected.length; i++) { track = selected[i]; if (!track || seen[track.url]) continue; seen[track.url] = true; task = this.loader.load(track, 12000); this.loads.push(task); (function (chosen, load, id, expectedGeneration) { load.promise.then(function (source) { var cues; if (!self.active || self.active.id !== id || self.active.generation !== expectedGeneration || typeof source !== 'string') return; cues = root[namespace].SubtitleParser.parse(source); if (!cues.length) { self.active.errors++; self.refresh(); return; } self.active.timelines[chosen.url] = new root[namespace].CueTimeline(cues); self.refresh(); }, function () { if (self.active && self.active.id === id && self.active.generation === expectedGeneration) { self.active.errors++; self.refresh(); } }); }(track, task, active.id, generation)); } };
    PlayerPrototype.prototype.time = function (seconds) { if (!this.active || isNaN(Number(seconds))) return; this.active.time = Number(seconds) * 1000; if (!this.pauseController.isPaused()) this.refresh(); };
    PlayerPrototype.prototype.diagnosticText = function (active) { return 'English Learning diagnostic\nselected: ' + (active.english ? 1 : 0) + '/' + (active.russian ? 1 : 0) + '\nerrors: ' + active.errors; };
    PlayerPrototype.prototype.renderNormal = function () { var a = this.active, en, ru, eCue, rCue, s = this.settings.values; if (!a) { this.overlay.remove(); this.pauseOverlay.remove(); this.diagnostic.render('English Learning: idle'); return; } eCue = a.english && a.timelines[a.english.url] ? a.timelines[a.english.url].getPrimary(a.time - s.englishOffsetMs) : null; rCue = a.russian && a.timelines[a.russian.url] ? a.timelines[a.russian.url].getPrimary(a.time - s.russianOffsetMs) : null; a.cue = eCue; en = eCue && eCue.text; ru = rCue && rCue.text; this.overlay.render(s.enabled, en, ru, s.showRussian, s.subtitleFontSizePx, s.subtitleBackdrop); this.diagnostic.render(this.diagnosticText(a)); };
    PlayerPrototype.prototype.pauseAt = function (anchorMs) { var a = this.active, s = this.settings.values, englishTimeline, russianTimeline, result; if (!a) { this.clearPauseView(); return; } a.time = Math.max(0, Number(anchorMs) || 0); if (!s.enabled || !s.pauseContextEnabled) { this.clearPauseView(); this.renderNormal(); return; } englishTimeline = a.english && a.timelines[a.english.url]; russianTimeline = a.russian && a.timelines[a.russian.url]; if (!englishTimeline) { this.clearPauseView(); this.renderNormal(); return; } result = root[namespace].ContextHistoryBuilder.build({ englishCues: englishTimeline.cues, russianCues: russianTimeline ? russianTimeline.cues : [], englishOffsetMs: s.englishOffsetMs, russianOffsetMs: s.russianOffsetMs, anchorMs: a.time, windowMs: 90000, graceMs: 2500, maxItems: 4 }); a.pauseSnapshot = result; a.cue = result.current ? result.current.cue : null; this.overlay.render(s.enabled, result.current && result.current.english, result.current && result.current.russian, s.showRussian, s.subtitleFontSizePx, s.subtitleBackdrop); this.pauseOverlay.render(result.items, s.subtitleFontSizePx, s.showRussian, this.overlay); this.diagnostic.render(this.diagnosticText(a)); };
    PlayerPrototype.prototype.clearPauseView = function () { if (this.active) this.active.pauseSnapshot = null; this.pauseOverlay.remove(); };
    PlayerPrototype.prototype.resumeFromPause = function () { this.clearPauseView(); this.refresh(); };
    PlayerPrototype.prototype.refresh = function () { var s = this.settings.values; if (this.active && this.pauseController.isPaused() && s.enabled && s.pauseContextEnabled) { this.pauseAt(this.active.time); return; } this.clearPauseView(); this.renderNormal(); };
    PlayerPrototype.prototype.repeatContext = function () { var a = this.active, s = this.settings.values; return { enabled:s.enabled, repeatEnabled:s.repeatEnabled, leadInMs:s.repeatLeadInMs, englishOffsetMs:s.englishOffsetMs, session:!!a, english:a&&a.english, timeline:a&&a.english&&a.timelines[a.english.url], cue:a&&a.cue }; };
    PlayerPrototype.prototype.cancelLoads = function () { var i; for (i=0;i<this.loads.length;i++) if (this.loads[i] && this.loads[i].abort) this.loads[i].abort(); this.loads=[]; };
    PlayerPrototype.prototype.clearSession = function () { this.session++; this.cancelLoads(); this.pauseController.reset(); this.active=null; this.overlay.remove(); this.pauseOverlay.remove(); this.diagnostic.remove(); this.panelButton.remove(); this.remote.reset(); };
    PlayerPrototype.prototype.sessionDestroyed = function () { this.panelButtonAllowed = false; this.clearSession(); };
    PlayerPrototype.prototype.destroy = function () { this.panelButtonAllowed = false; this.clearSession(); if (this.onCreate) this.player.listener.remove('create',this.onCreate); if (this.onExternal) this.player.listener.remove('external',this.onExternal); this.setTimeSource(null); this.pauseController.stop(); this.remote.stop(); };
    PlayerPrototype.prototype.getState = function () { return { session:!!this.active, tracks:this.active?this.active.tracks.length:0, loaded:this.active?Object.keys(this.active.timelines).length:0, errors:this.active?this.active.errors:0, cueId:this.active&&this.active.cue?this.active.cue.id:null, paused:this.pauseController.isPaused(), pauseItems:this.active&&this.active.pauseSnapshot?this.active.pauseSnapshot.items.length:0, diagnostics:this.diagnostic.enabled, panelButton:this.panelButton.isMounted(), settings:this.settings.get(), english:this.active&&this.active.english?this.active.english.label:null, russian:this.active&&this.active.russian?this.active.russian.label:null }; };
    root[namespace].SubtitleLoader = SubtitleLoader;
    root[namespace].PlayerPrototype = { create:function(player,host){return new PlayerPrototype(player,host);}, inventory:inventory };

/* SPDX-License-Identifier: GPL-2.0-only */
    function RepeatController(root, context) { this.root = root; this.context = context; }
    RepeatController.prototype.repeat = function () { var state = this.context(), video, target; if (!state || !state.enabled || !state.repeatEnabled || !state.session || !state.english || !state.timeline || !state.cue) return false; video = this.root.Lampa && this.root.Lampa.PlayerVideo; if (!video || typeof video.to !== 'function') return false; target = Math.max(0, (Number(state.cue.start) + Number(state.englishOffsetMs || 0) - Number(state.leadInMs || 0)) / 1000); if (!isFinite(target)) return false; try { video.to(target); } catch (error) { return false; } return true; };
    function RemoteController(root, repeat) { this.root = root; this.repeat = repeat; this.listener = null; this.onKeydown = null; this.lastHandled = 0; }
    RemoteController.prototype.start = function () { var keypad = this.root.Lampa && this.root.Lampa.Keypad, self = this; if (this.onKeydown || !keypad || !keypad.listener || typeof keypad.listener.follow !== 'function' || typeof keypad.listener.remove !== 'function') return false; this.listener = keypad.listener; this.onKeydown = function (payload) { self.handle(payload); }; this.listener.follow('keydown', this.onKeydown); return true; };
    RemoteController.prototype.reset = function () { this.lastHandled = 0; };
    RemoteController.prototype.stop = function () { if (this.listener && this.onKeydown) this.listener.remove('keydown', this.onKeydown); this.listener = null; this.onKeydown = null; this.lastHandled = 0; };
    RemoteController.prototype.code = function (payload) { var event = payload && payload.event, code = payload && payload.code; if (typeof code !== 'number' && event) code = typeof event.keyCode === 'number' ? event.keyCode : event.which; return Number(code); };
    RemoteController.prototype.handle = function (payload) { var event = payload && payload.event, clock = this.root.Date && this.root.Date.now, now, handled; if (!payload || payload.enabled === false || this.code(payload) !== 403 || (event && event.repeat)) return false; now = typeof clock === 'function' ? clock() : Date.now(); if (now - this.lastHandled < 650) return false; handled = this.repeat.repeat(); if (!handled) return false; this.lastHandled = now; if (event && typeof event.preventDefault === 'function') event.preventDefault(); if (event && typeof event.stopPropagation === 'function') event.stopPropagation(); return true; };
    root[namespace].RepeatController = RepeatController;
    root[namespace].RemoteController = RemoteController;

    /* SPDX-License-Identifier: GPL-2.0-only */
    root[namespace].start();
})(typeof window !== 'undefined' ? window : this);
