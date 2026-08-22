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
