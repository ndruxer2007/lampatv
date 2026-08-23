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
