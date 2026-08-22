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
