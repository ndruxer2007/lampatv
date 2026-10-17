/* Animevost catalog for Lampa. SPDX-License-Identifier: GPL-2.0-only
 * Source: https://github.com/ndruxer2007/lampatv/blob/main/animevost.js
 * License: https://www.gnu.org/licenses/old-licenses/gpl-2.0.txt
 */
(function (root, factory) {
    'use strict';
    var api = factory(root);
    if (typeof module === 'object' && module.exports) module.exports = api;
    else if (!root.AnimevostCatalog) {
        root.AnimevostCatalog = api;
        api.install();
    }
}(typeof window !== 'undefined' ? window : globalThis, function (root) {
    'use strict';

    var version = '0.2.1';
    var storageKey = 'animevost_schedule_proxy';
    var apiUrl = 'https://api.animetop.info/v1/last';
    var days = [
        ['Mon', 'Понедельник'], ['Tue', 'Вторник'], ['Wed', 'Среда'],
        ['Thu', 'Четверг'], ['Fri', 'Пятница'], ['Sat', 'Суббота'], ['Sun', 'Воскресенье']
    ];
    var installed = false;
    var readyHandler;

    function text(value) {
        return (typeof value === 'string' ? value : '').replace(/<(script|style|iframe)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '')
            .replace(/<br\s*\/?\s*>/gi, '\n').replace(/<[^>]*>/g, ' ')
            .replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, function (all, entity) {
                var map = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
                if (entity.charAt(0) !== '#') return map[entity.toLowerCase()] || all;
                var code = entity.charAt(1).toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
                if (!code || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)) return '';
                if (code <= 0xffff) return String.fromCharCode(code);
                code -= 0x10000;
                return String.fromCharCode(0xd800 + (code >> 10), 0xdc00 + (code & 1023));
            }).replace(/[ \t\r]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
    }

    function safeUrl(value, base) {
        if (typeof value !== 'string' || !value.trim() || !root.URL) return '';
        try {
            var url = new root.URL(value.trim(), base);
            return url.protocol === 'https:' && !url.username && !url.password ? url.href : '';
        } catch (error) { return ''; }
    }

    function proxyAddress(value) {
        var url = safeUrl(value);
        // The endpoint is a fixed route, not an open-proxy URL with query parameters.
        return url && url.indexOf('?') === -1 && url.indexOf('#') === -1 ? url : '';
    }

    function parseFeed(payload, page) {
        var json = typeof payload === 'string' ? JSON.parse(payload) : payload;
        if (page < 1 || Math.floor(page) !== page || !json || !json.state || json.state.status !== 'ok' || Number(json.state.page) !== page ||
            !Array.isArray(json.data) || json.data.length > 10 || !isFinite(Number(json.state.count)) ||
            json.state.count == null || Number(json.state.count) < json.data.length || Math.floor(Number(json.state.count)) !== Number(json.state.count)) {
            throw new Error('Источник вернул неизвестный формат обновлений.');
        }
        var cards = json.data.map(function (item) {
            if (!item || !/^\d+$/.test(String(item.id)) || Number(item.id) <= 0 || !text(item.title)) {
                throw new Error('Источник вернул неполную карточку обновления.');
            }
            var fullTitle = text(item.title);
            var labels = fullTitle.match(/\[[^\]]+\]/g) || [];
            return {
                key: 'anime-' + item.id,
                title: fullTitle.split(' / ')[0].replace(/\s*\[[^\]]*\]/g, '').trim() || fullTitle,
                fullTitle: fullTitle,
                originalTitle: (fullTitle.split(' / ')[1] || '').replace(/\s*\[[^\]]*\]/g, '').trim(),
                year: /^\d{4}$/.test(String(item.year || '')) ? String(item.year) : '',
                media: item.type === 'ТВ' ? 'tv' : '',
                info: labels.join(' · ') || 'Сведения о сериях не указаны',
                description: text(item.description),
                poster: safeUrl(item.urlImagePreview)
            };
        });
        return { cards: cards, hasNext: cards.length === 10 && page * 10 < Number(json.state.count) };
    }

    function parseSchedule(html, parseDocument) {
        if (typeof html !== 'string' || html.length > 1024 * 1024 || !html.trim()) throw new Error('Расписание не получено.');
        // Parse only inert markup. Discard resource-bearing elements before DOMParser.
        var inert = html.replace(/<(script|style|iframe|object)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '')
            .replace(/<(?:img|link|base|embed|source|video|audio)\b[^>]*>/gi, '');
        var doc = parseDocument ? parseDocument(inert) : new root.DOMParser().parseFromString(inert, 'text/html');
        return days.map(function (day) {
            var node = doc.getElementById('raspis' + day[0]);
            if (!node) throw new Error('Сайт изменил расписание или вернул страницу защиты.');
            var links = node.querySelectorAll('a[href]');
            var cards = [];
            for (var i = 0; i < links.length; i++) {
                var link = links[i];
                var url = safeUrl(link.getAttribute('href'), 'https://animevost.org/');
                if (!url || new root.URL(url).origin !== 'https://animevost.org' || !/\.html$/.test(new root.URL(url).pathname)) {
                    throw new Error('Неизвестная ссылка в расписании источника.');
                }
                // textContent is already decoded; do not treat it as HTML a second time.
                var label = (link.textContent || '').replace(/\s+/g, ' ').trim();
                if (!label) throw new Error('Пустое название в расписании источника.');
                var suffix = label.match(/\s*~\s*\(([^()]*)\)\s*$/);
                var title = suffix ? label.slice(0, suffix.index).trim() : label;
                var time = suffix ? suffix[1].trim() : '';
                if (!title) throw new Error('Пустое название в расписании источника.');
                cards.push({ key: day[0] + '-' + i, title: title, fullTitle: title,
                    info: day[1] + ' · ' + (time || 'Время не указано'), description: '', poster: '' });
            }
            return { key: day[0], title: day[1], cards: cards };
        });
    }

    function searchNames(card, query) {
        var result = [];
        (query ? [query] : [card.title, card.originalTitle]).forEach(function (value) {
            var name = text(value).replace(/\[[^\]]*\]/g, '').replace(/[<>\x00-\x1f\x7f]/g, ' ')
                .replace(/\s*\([^)]*(?:сезон|часть)[^)]*\)\s*$/i, '')
                .replace(/\s+(?:(?:season|part)\s*\d+|\d+(?:st|nd|rd|th)\s+season|[IVX]{2,})\s*$/i, '')
                .replace(/\s+/g, ' ').trim().slice(0, 200);
            if (name && result.indexOf(name) === -1) result.push(name);
        });
        return result.slice(0, 2);
    }

    function titleIdentity(value) {
        return text(value).toLowerCase().replace(/ё/g, 'е').replace(/[\s.,!?:;'"«»()[\]{}_\-–—/\\]+/g, '');
    }

    function parseMatches(json, method) {
        if (!json || !Array.isArray(json.results) || ['tv', 'movie'].indexOf(method) === -1) {
            throw new Error('Неизвестный формат ответа каталога Lampa.');
        }
        return json.results.slice(0, 20).map(function (item) {
            if (!item || !/^\d+$/.test(String(item.id)) || !isFinite(Number(item.id)) ||
                Number(item.id) < 1 || Number(item.id) > 9007199254740991 || !text(method === 'tv' ? item.name : item.title)) {
                throw new Error('Каталог вернул неполную карточку.');
            }
            // Only metadata fields used by the native card; never copy an arbitrary source object.
            var data = { id: Number(item.id), source: 'tmdb' };
            ['name', 'title', 'original_name', 'original_title', 'poster_path', 'backdrop_path', 'overview',
                'first_air_date', 'release_date', 'original_language'].forEach(function (field) {
                if (typeof item[field] === 'string') data[field] = text(item[field]).replace(/[<>]/g, '');
            });
            if (!(method === 'tv' ? data.name : data.title).trim()) throw new Error('Пустое название карточки.');
            var date = method === 'tv' ? data.first_air_date : data.release_date;
            return { key: 'tmdb-' + method + '-' + data.id, method: method, data: data,
                title: method === 'tv' ? data.name : data.title,
                originalTitle: method === 'tv' ? data.original_name : data.original_title,
                year: /^\d{4}-\d{2}-\d{2}$/.test(date || '') ? date.slice(0, 4) : '',
                animation: Array.isArray(item.genre_ids) && item.genre_ids.indexOf(16) !== -1 };
        });
    }

    function automaticMatch(card, matches, complete) {
        // A continuation's year may be unrelated to the native series' first year.
        var continuation = [card.title, card.originalTitle, card.fullTitle].some(function (value) {
            return /сезон|часть|\bseason\b|\bpart\b|\b[IVX]{2,}\s*$/i.test((value || '').replace(/\[[^\]]*\]/g, '').trim());
        });
        if (!complete || !card.year || !card.media || continuation) return null;
        var names = [card.title, card.originalTitle].map(titleIdentity).filter(Boolean);
        var exact = matches.filter(function (item) {
            return item.method === card.media && item.year === card.year && item.animation &&
                [item.title, item.originalTitle].some(function (name) { return name && names.indexOf(titleIdentity(name)) !== -1; });
        });
        return exact.length === 1 ? exact[0] : null;
    }

    function resolveCard(card, adapter, callback, options) {
        card = card && typeof card === 'object' ? card : {};
        options = options || {};
        var clock = options.clock || root;
        var finished = false;
        var timer;
        var rows = [];
        var failures = 0;
        var complete = true;
        var remaining = 0;
        function cancel() { finished = true; if (timer !== undefined) clock.clearTimeout(timer); }
        function finish(message) {
            if (finished) return;
            cancel();
            callback({ matches: rows, error: message || '', partial: failures > 0,
                automatic: automaticMatch(card, rows, complete && !failures && !options.query) });
        }
        try {
            if (!adapter || typeof adapter.get !== 'function') {
                finish('Поиск TMDB недоступен в этой сборке Lampa.'); return cancel;
            }
            var names = searchNames(card, options.query);
            if (!names.length) { finish('Укажите название для поиска карточки.'); return cancel; }
            var methods = card.media === 'tv' || card.media === 'movie' ? [card.media] : ['tv', 'movie'];
            var jobs = [];
            names.forEach(function (name) { methods.forEach(function (method) { jobs.push({ name: name, method: method }); }); });
            remaining = jobs.length;
            timer = clock.setTimeout(function () {
                failures++; complete = false; finish('Поиск не завершился вовремя. Можно повторить запрос.');
            }, 15000);
            jobs.forEach(function (job) {
                if (finished) return;
                var settled = false;
                function done(json, failed) {
                    if (finished || settled) return;
                    settled = true;
                    if (!failed) {
                        try {
                            var found = parseMatches(json, job.method);
                            if (json.total_pages == null || Number(json.total_pages) < 0 || Number(json.total_pages) > 1 ||
                                Math.floor(Number(json.total_pages)) !== Number(json.total_pages) || Number(json.page) !== 1 || json.results.length > 20) complete = false;
                            found.forEach(function (item) {
                                if (!rows.some(function (old) { return old.key === item.key; })) rows.push(item);
                            });
                        } catch (error) { failed = true; }
                    }
                    if (failed) failures++;
                    if (--remaining === 0) finish(failures ? (rows.length ? 'Часть поиска недоступна. Проверьте выбранный тайтл.' : 'Не удалось получить карточки TMDB. Повторите запрос или уточните название.') : '');
                }
                try { adapter.get('search/' + job.method, { query: encodeURIComponent(job.name), page: 1 },
                    function (json) { done(json, false); }, function () { done(null, true); }); }
                catch (error) { done(null, true); }
            });
        } catch (error) { failures++; finish('Поиск TMDB недоступен в этой сборке Lampa.'); }
        // Do not call adapter.clear(): its request queue belongs to the whole Lampa runtime.
        return cancel;
    }

    function supported(lampa, probeInstances) {
        function has(object, names) {
            return object && names.every(function (name) { return typeof object[name] === 'function'; });
        }
        var valid = !!(typeof root.jQuery === 'function' && typeof root.URL === 'function' && typeof root.DOMParser === 'function' && root.Navigator &&
            has(root.Navigator, ['move', 'canmove']) && lampa &&
            has(lampa.Component, ['add']) && has(lampa.Activity, ['push', 'backward', 'active']) &&
            has(lampa.Controller, ['add', 'toggle', 'enabled', 'collectionSet', 'collectionFocus']) &&
            has(lampa.Modal, ['open', 'close']) && has(lampa.Storage, ['get', 'set']) &&
            has(lampa.Input, ['edit']) && has(lampa.Select, ['show', 'close']) &&
            typeof lampa.Scroll === 'function' && typeof lampa.Reguest === 'function');
        // Keep startup passive; inspect instance APIs only when Animevost is opened.
        if (!valid || !probeInstances) return valid;
        var scroll;
        var result = false;
        try {
            var request = new lampa.Reguest();
            if (!has(request, ['clear', 'timeout', 'native'])) return false;
            request.clear();
            request.timeout(15000);
            scroll = new lampa.Scroll({ mask: true, over: true });
            if (!has(scroll, ['minus', 'append', 'render', 'update', 'destroy'])) return false;
            var view = scroll.render();
            result = !!(view && typeof view.find === 'function');
        } catch (error) { result = false; }
        finally {
            if (scroll && typeof scroll.destroy === 'function') {
                try { scroll.destroy(); } catch (error) { result = false; }
            }
        }
        return result;
    }

    function Component(object) {
        var Lampa = root.Lampa;
        var $ = root.jQuery;
        var self = this;
        var mode = ['home', 'updates', 'schedule', 'match'].indexOf(object.animevost_view) !== -1 ? object.animevost_view : 'home';
        var sourceCard = object.animevost_card && typeof object.animevost_card === 'object' ? object.animevost_card : {};
        var matches = [];
        var query = '';
        var cancelResolve = null;
        var chosenDay = days.some(function (day) { return day[0] === object.animevost_day; }) ? object.animevost_day : '';
        var html = $('<div class="animevost"></div>');
        var body = $('<div class="animevost__body"></div>');
        var scroll = new Lampa.Scroll({ mask: true, over: true, step: 250 });
        var network = new Lampa.Reguest();
        var cards = [];
        var schedule = [];
        var page = 0;
        var hasNext = false;
        var busy = false;
        var loaded = false;
        var loadedProxy = '';
        var destroyed = false;
        var generation = 0;
        var lastKey = '';
        var errorText = '';
        var modalContent = null;
        var modalOptions = null;

        function current() {
            var active = Lampa.Activity.active();
            return !destroyed && active && active.activity === self.activity;
        }

        function ownsController() {
            var active = Lampa.Controller.enabled();
            return current() && active.name === 'content' && active.controller && active.controller.link === self;
        }

        function findFocus() {
            var elements = body.find('.selector');
            var found = elements.filter(function () { return $(this).attr('data-animevost-key') === lastKey; });
            return (found.length ? found : elements.filter('[data-animevost-primary]').first())[0] || elements[0];
        }

        function focus() {
            Lampa.Controller.collectionSet(scroll.render());
            Lampa.Controller.collectionFocus(findFocus() || false, scroll.render());
        }

        function addAction(key, title, subtitle, action, primary) {
            var item = $('<div class="animevost__action selector"><div class="animevost__title"></div><div class="animevost__meta"></div></div>');
            item.attr('data-animevost-key', key);
            if (primary) item.attr('data-animevost-primary', 'true');
            item.find('.animevost__title').text(title);
            item.find('.animevost__meta').text(subtitle || '');
            bind(item, key, action);
            body.append(item);
            return item;
        }

        function bind(item, key, action) {
            item.on('hover:focus', function () {
                lastKey = key;
                scroll.update(item);
            }).on('hover:hover', function () {
                lastKey = key;
            }).on('hover:enter', function () {
                if (current()) { lastKey = key; action(); }
            });
        }

        function push(view, title, day) {
            Lampa.Activity.push({ url: '', title: title, component: 'animevost',
                animevost_view: view, animevost_day: day || '', page: 1 });
        }

        function notice(message) {
            if (Lampa.Noty && typeof Lampa.Noty.show === 'function') Lampa.Noty.show(message);
        }

        function configure() {
            var previousValue = Lampa.Storage.get(storageKey, '');
            Lampa.Input.edit({ title: 'HTTPS-адрес Worker расписания', value: typeof previousValue === 'string' ? previousValue : '',
                free: true, nosave: true, nomic: true }, function (value) {
                if (!current()) return;
                self.start();
                value = typeof value === 'string' ? value.trim() : '';
                if (value && !proxyAddress(value)) {
                    notice('Нужен HTTPS-адрес без логина, пароля, параметров и фрагмента.');
                    return;
                }
                if (value === previousValue) return;
                Lampa.Select.show({ title: 'Сохранить адрес расписания?',
                    items: [{ title: 'Сохранить', save: true }, { title: 'Отменить' }],
                    onSelect: function (item) {
                        Lampa.Select.close();
                        if (!current()) return;
                        if (item.save) {
                            Lampa.Storage.set(storageKey, value);
                            loaded = false;
                            schedule = [];
                            cancel();
                            errorText = '';
                        }
                        self.start();
                        render();
                        if (item.save && mode === 'schedule' && value) load();
                    },
                    onBack: function () { Lampa.Select.close(); if (current()) self.start(); }
                });
            });
        }

        function releaseDetail(restore) {
            var content = modalContent;
            var options = modalOptions;
            modalContent = null;
            modalOptions = null;
            if (!content) return;
            if (root.document.documentElement.contains(content[0])) Lampa.Modal.close();
            content.remove();
            // Lampa retains its last params object after close. Release our references.
            if (options) { options.html = null; options.onBack = null; }
            if (restore && current()) self.start();
        }

        function detail(card) {
            var content = $('<div class="animevost__detail"><div class="animevost__detail-title"></div><p class="animevost__detail-info"></p><div class="animevost__description"></div></div>');
            content.find('.animevost__detail-title').text(card.fullTitle || card.title || 'Аниме');
            content.find('.animevost__detail-info').text(card.info || 'Сведения о сериях не указаны');
            content.find('.animevost__description').text(card.description || 'Описание источником не предоставлено.');
            modalContent = content;
            modalOptions = { title: 'Animevost', html: content, size: 'large', mask: true, onBack: function () { releaseDetail(true); } };
            Lampa.Modal.open(modalOptions);
        }

        function openFull(match) {
            if (!current() || !matches.some(function (item) { return item === match; })) return;
            lastKey = match.key;
            try {
                Lampa.Activity.push({ url: '', title: match.title, component: 'full', id: match.data.id,
                    method: match.method, card: match.data, source: 'tmdb' });
            } catch (error) {
                if (current()) { errorText = 'Не удалось открыть стандартную карточку Lampa.'; render(); }
            }
        }

        function findCard(card) {
            Lampa.Activity.push({ url: '', title: 'Animevost — карточка Lampa', component: 'animevost',
                animevost_view: 'match', animevost_card: card, page: 1 });
        }

        function clarify() {
            var previous = query || searchNames(sourceCard)[0] || '';
            Lampa.Input.edit({ title: 'Название аниме для поиска', value: previous, free: true, nosave: true, nomic: true }, function (value) {
                if (!current()) return;
                self.start();
                value = typeof value === 'string' ? value.trim() : '';
                if (!value || value === previous) return;
                query = value;
                loadMatch();
            });
        }

        function loadMatch() {
            if (!current() || busy) return;
            cancel();
            var token = ++generation;
            busy = true;
            loaded = false;
            errorText = '';
            matches = [];
            lastKey = '';
            render();
            var adapter;
            try { adapter = Lampa.Api && Lampa.Api.sources && Lampa.Api.sources.tmdb; } catch (error) {}
            cancelResolve = resolveCard(sourceCard, adapter, function (result) {
                if (!current() || token !== generation) return;
                busy = false;
                loaded = true;
                matches = result.matches;
                errorText = result.error;
                if (lastKey !== 'source-info') lastKey = '';
                render();
                if (result.automatic && ownsController()) openFull(result.automatic);
            }, { query: query });
        }

        function addCard(card) {
            var item = $('<div class="animevost__card selector"><div class="animevost__poster"><span>Нет постера</span></div><div class="animevost__card-body"><div class="animevost__title"></div><div class="animevost__meta"></div></div></div>');
            item.attr('data-animevost-key', card.key).attr('data-animevost-primary', 'true');
            item.find('.animevost__title').text(card.title);
            item.find('.animevost__meta').text(card.info);
            if (mode !== 'updates') item.addClass('animevost__card--schedule');
            else if (card.poster) {
                var image = $('<img alt="">');
                image.on('error', function () { image.remove(); }).on('load', function () { image.siblings('span').hide(); });
                image.attr('src', card.poster);
                item.find('.animevost__poster').append(image);
            }
            bind(item, card.key, function () { findCard(card); });
            body.append(item);
        }

        function render() {
            if (destroyed) return;
            body.empty();
            var title = mode === 'home' ? 'Animevost' : mode === 'updates' ? 'Последние обновления' : mode === 'match' ? 'Карточка Lampa' : 'Расписание';
            body.append($('<h2 class="animevost__heading"></h2>').text(title));
            if (mode === 'match') {
                body.append($('<p class="animevost__note"></p>').text(sourceCard.title || 'Аниме'));
                if (busy) body.append($('<p class="animevost__status" role="status"></p>').text('Поиск карточки в Lampa…'));
                else if (loaded && !matches.length && !errorText) body.append($('<p class="animevost__note"></p>').text('Совпадений не найдено. Попробуйте другое название.'));
                if (errorText) body.append($('<p class="animevost__error" role="status"></p>').text(errorText));
                if (matches.length) body.append($('<p class="animevost__note"></p>').text('Выберите карточку из первых результатов или уточните название. Продолжение может находиться в общей карточке сериала.'));
                matches.forEach(function (match) {
                    addAction(match.key, match.title, (match.method === 'tv' ? 'Сериал' : 'Фильм') + ' · ' +
                        (match.year || 'Год не указан') + ' · TMDB' + (match.originalTitle ? ' · ' + match.originalTitle : ''),
                        function () { openFull(match); }, true);
                });
                addAction('retry-match', busy ? 'Поиск…' : 'Повторить поиск', '', loadMatch);
                if (!busy) {
                    addAction('clarify', 'Уточнить название', query || searchNames(sourceCard)[0] || '', clarify);
                }
                addAction('source-info', 'Информация Animevost', 'Название, серии и описание источника', function () { detail(sourceCard); });
            } else if (mode === 'home') {
                addAction('updates', 'Последние обновления', 'Доступные серии в порядке ленты Animevost', function () { push('updates', 'Animevost — обновления'); }, true);
                addAction('schedule', 'Расписание', 'Примерное время русской озвучки, МСК', function () { push('schedule', 'Animevost — расписание'); });
                addAction('configure', 'Настроить расписание', 'Адрес собственного HTTPS Worker · ' + version, configure);
            } else {
                if (mode === 'schedule') {
                    body.append($('<p class="animevost__note"></p>').text('Примерное время выхода русской озвучки, МСК. Возможны переносы.'));
                    if (loaded && !chosenDay) {
                        schedule.forEach(function (day) {
                            addAction('day-' + day.key, day.title, day.cards.length ? day.cards.length + ' в расписании' : 'В расписании нет записей',
                                function () { push('schedule', 'Animevost — ' + day.title, day.key); }, true);
                        });
                    } else if (loaded) {
                        var day = schedule.filter(function (entry) { return entry.key === chosenDay; })[0];
                        if (day) {
                            body.append($('<h3 class="animevost__day"></h3>').text(day.title));
                            day.cards.forEach(addCard);
                            if (!day.cards.length) body.append($('<p class="animevost__note"></p>').text('На этот день записей нет.'));
                        }
                    }
                } else {
                    cards.forEach(addCard);
                    if (loaded && !cards.length) body.append($('<p class="animevost__note"></p>').text('Обновлений пока нет.'));
                }
                if (busy) body.append($('<p class="animevost__status" role="status"></p>').text('Загрузка…'));
                if (errorText) {
                    body.append($('<p class="animevost__error" role="status"></p>').text(errorText));
                    if ((mode === 'updates' && !loaded) || (mode === 'schedule' && proxyAddress(Lampa.Storage.get(storageKey, '')))) {
                        addAction('retry', 'Повторить', '', load, true);
                    }
                }
                if (mode === 'updates' && loaded && hasNext) addAction('next', busy ? 'Загрузка…' : errorText ? 'Повторить загрузку' : 'Загрузить еще', 'Следующая страница обновлений', load);
                if (mode === 'schedule' && !busy) addAction('configure', 'Настроить расписание', 'HTTPS-адрес собственного Worker', configure);
            }
            addAction('back', 'Назад', '', function () { Lampa.Activity.backward(); });
            if (ownsController()) focus();
        }

        function cancel() {
            generation++;
            if (cancelResolve) { cancelResolve(); cancelResolve = null; }
            try { network.clear(); } catch (error) {} // Callback invalidation, not transport abort.
            busy = false;
        }

        function load() {
            if (destroyed || busy || mode === 'home') return;
            var url = mode === 'updates' ? apiUrl + '?page=' + (page + 1) + '&quantity=10' : proxyAddress(Lampa.Storage.get(storageKey, ''));
            if (!url) {
                if (!lastKey || lastKey === 'back') lastKey = 'configure';
                errorText = 'Расписание требует собственного HTTPS Worker. Укажите его адрес в «Настроить расписание». Обновления работают отдельно.';
                render();
                return;
            }
            var token = ++generation;
            busy = true;
            errorText = '';
            render();
            function failed(message) {
                if (destroyed || token !== generation) return;
                busy = false;
                errorText = message;
                render();
            }
            try {
                network.clear();
                network.timeout(15000);
                network.native(url, function (response) {
                    if (destroyed || token !== generation) return;
                    try {
                        if (mode === 'updates') {
                            var result = parseFeed(response, page + 1);
                            var oldLength = cards.length;
                            result.cards.forEach(function (card) {
                                if (!cards.some(function (old) { return old.key === card.key; })) cards.push(card);
                            });
                            page++;
                            hasNext = result.hasNext;
                            if (lastKey === 'next' && !hasNext) lastKey = (cards[oldLength] || cards[cards.length - 1] || {}).key || '';
                        } else { schedule = parseSchedule(response); loadedProxy = url; }
                        busy = false;
                        loaded = true;
                        // A loading-only focus is replaced by the first available result.
                        if (lastKey === 'back' || lastKey === 'retry') lastKey = '';
                        render();
                    } catch (error) { failed(error.message || 'Не удалось разобрать ответ источника.'); }
                }, function () { failed('Источник недоступен. Проверьте подключение и повторите запрос.'); }, false, { dataType: 'text' });
            } catch (error) { failed('Не удалось выполнить запрос к источнику.'); }
        }

        this.create = function () {
            scroll.minus();
            scroll.append(body);
            html.append(scroll.render());
            render();
            this.activity.loader(false);
            return this.render();
        };
        this.start = function () {
            if (!current()) return;
            if (mode === 'schedule') {
                var selectedProxy = proxyAddress(Lampa.Storage.get(storageKey, ''));
                if (selectedProxy !== loadedProxy) {
                    cancel();
                    loadedProxy = selectedProxy;
                    loaded = false;
                    schedule = [];
                    errorText = '';
                    render();
                }
            }
            Lampa.Controller.add('content', {
                link: self,
                toggle: focus,
                left: function () { if (root.Navigator.canmove('left')) root.Navigator.move('left'); else Lampa.Controller.toggle('menu'); },
                right: function () { root.Navigator.move('right'); },
                up: function () { if (root.Navigator.canmove('up')) root.Navigator.move('up'); else Lampa.Controller.toggle('head'); },
                down: function () { root.Navigator.move('down'); },
                back: function () { Lampa.Activity.backward(); }
            });
            Lampa.Controller.toggle('content');
            if (!loaded && !busy && mode !== 'home' && !errorText) {
                if (mode === 'match') loadMatch();
                else load();
            }
        };
        this.pause = function () { cancel(); render(); };
        this.stop = function () { cancel(); render(); };
        this.render = function () { return html; };
        this.destroy = function () {
            if (destroyed) return;
            destroyed = true;
            cancel();
            releaseDetail(false);
            scroll.destroy();
            html.remove();
            cards = [];
            schedule = [];
            matches = [];
            sourceCard = {};
        };
    }

    function install() {
        var Lampa = root.Lampa;
        if (installed || !Lampa) return;
        function start() {
            if (installed || !supported(Lampa)) return;
            var button;
            var style;
            try {
                var $ = root.jQuery;
                var menu = $('.menu .menu__list').eq(0);
                if (!menu.length) return;
                button = $('<li class="menu__item selector animevost-menu"><div class="menu__ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 4h16v16H4zM9 7l8 5-8 5z"/></svg></div><div class="menu__text">Animevost</div></li>');
                style = $('<style id="animevost-style"></style>').text(
                    '.animevost__body{padding:1em 1.2em 3em}.animevost__heading{font-size:1.5em;margin:0 0 1em}.animevost__day{margin:1em 0}' +
                    '.animevost__action,.animevost__card{box-sizing:border-box;border:2px solid transparent;border-radius:.65em;background:rgba(255,255,255,.07);padding:1em;margin:0 0 12px}' +
                    '.animevost__action.focus,.animevost__card.focus{border-color:#ffbe69;background:rgba(255,190,105,.16)}' +
                    '.animevost__title{font-size:1.2em;line-height:1.3;max-height:3.9em;overflow:hidden;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow-wrap:break-word;word-wrap:break-word}' +
                    '.animevost__meta{opacity:.75;line-height:1.4;margin-top:.45em;max-height:2.8em;overflow:hidden;overflow-wrap:break-word;word-wrap:break-word}' +
                    '.animevost__card{display:flex;align-items:center;gap:1em}.animevost__card-body{min-width:0;flex:1}' +
                    '.animevost__poster{position:relative;width:5em;height:7.5em;flex:0 0 5em;display:flex;align-items:center;justify-content:center;text-align:center;background:rgba(0,0,0,.25);margin-right:1em;overflow:hidden;border-radius:.35em}' +
                    '.animevost__poster span{font-size:.7em;opacity:.6}.animevost__poster img{position:absolute;width:100%;height:100%;object-fit:cover;left:0;top:0}.animevost__card--schedule .animevost__poster{display:none}' +
                    '.animevost__error{color:#ffce97}.animevost__note,.animevost__status,.animevost__error{line-height:1.5;margin:0 0 1em;overflow-wrap:break-word}' +
                    '.animevost__detail-title{font-size:1.25em;line-height:1.4}.animevost__detail-info{margin:1em 0;opacity:.8}.animevost__description{white-space:pre-wrap;line-height:1.5}.animevost__detail{overflow-wrap:break-word;word-wrap:break-word}' +
                    '@media(max-width:480px){.animevost__body{padding:.5em .5em 2em}.animevost__poster{width:3em;height:4.5em;flex-basis:3em}.animevost__action,.animevost__card{padding:.6em}.animevost__title{font-size:1em}}'
                );
                Lampa.Component.add('animevost', Component);
                button.on('hover:enter', function () {
                    if (!supported(Lampa, true)) {
                        if (Lampa.Noty && typeof Lampa.Noty.show === 'function') {
                            Lampa.Noty.show('Animevost недоступен: несовместимые Scroll/Reguest в этой сборке Lampa.');
                        }
                        return;
                    }
                    Lampa.Activity.push({ url: '', title: 'Animevost', component: 'animevost', animevost_view: 'home', page: 1 });
                });
                $('head').append(style);
                menu.append(button);
                installed = true;
            } catch (error) { if (button) button.remove(); if (style) style.remove(); }
            if (readyHandler && Lampa.Listener && typeof Lampa.Listener.remove === 'function') Lampa.Listener.remove('app', readyHandler);
        }
        if (root.appready) start();
        else if (!readyHandler && Lampa.Listener && typeof Lampa.Listener.follow === 'function') {
            readyHandler = function (event) { if (event.type === 'ready') start(); };
            Lampa.Listener.follow('app', readyHandler);
        }
    }

    return { version: version, text: text, safeUrl: safeUrl, proxyAddress: proxyAddress,
        parseFeed: parseFeed, parseSchedule: parseSchedule, searchNames: searchNames, parseMatches: parseMatches,
        automaticMatch: automaticMatch, resolveCard: resolveCard, supported: supported, Component: Component, install: install };
}));

/* Full license text follows; no separate public file is required.
                    GNU GENERAL PUBLIC LICENSE
                       Version 2, June 1991

 Copyright (C) 1989, 1991 Free Software Foundation, Inc.,
 <https://fsf.org/>
 Everyone is permitted to copy and distribute verbatim copies
 of this license document, but changing it is not allowed.

                            Preamble

  The licenses for most software are designed to take away your
freedom to share and change it.  By contrast, the GNU General Public
License is intended to guarantee your freedom to share and change free
software--to make sure the software is free for all its users.  This
General Public License applies to most of the Free Software
Foundation's software and to any other program whose authors commit to
using it.  (Some other Free Software Foundation software is covered by
the GNU Lesser General Public License instead.)  You can apply it to
your programs, too.

  When we speak of free software, we are referring to freedom, not
price.  Our General Public Licenses are designed to make sure that you
have the freedom to distribute copies of free software (and charge for
this service if you wish), that you receive source code or can get it
if you want it, that you can change the software or use pieces of it
in new free programs; and that you know you can do these things.

  To protect your rights, we need to make restrictions that forbid
anyone to deny you these rights or to ask you to surrender the rights.
These restrictions translate to certain responsibilities for you if you
distribute copies of the software, or if you modify it.

  For example, if you distribute copies of such a program, whether
gratis or for a fee, you must give the recipients all the rights that
you have.  You must make sure that they, too, receive or can get the
source code.  And you must show them these terms so they know their
rights.

  We protect your rights with two steps: (1) copyright the software, and
(2) offer you this license which gives you legal permission to copy,
distribute and/or modify the software.

  Also, for each author's protection and ours, we want to make certain
that everyone understands that there is no warranty for this free
software.  If the software is modified by someone else and passed on, we
want its recipients to know that what they have is not the original, so
that any problems introduced by others will not reflect on the original
authors' reputations.

  Finally, any free program is threatened constantly by software
patents.  We wish to avoid the danger that redistributors of a free
program will individually obtain patent licenses, in effect making the
program proprietary.  To prevent this, we have made it clear that any
patent must be licensed for everyone's free use or not licensed at all.

  The precise terms and conditions for copying, distribution and
modification follow.

                    GNU GENERAL PUBLIC LICENSE
   TERMS AND CONDITIONS FOR COPYING, DISTRIBUTION AND MODIFICATION

  0. This License applies to any program or other work which contains
a notice placed by the copyright holder saying it may be distributed
under the terms of this General Public License.  The "Program", below,
refers to any such program or work, and a "work based on the Program"
means either the Program or any derivative work under copyright law:
that is to say, a work containing the Program or a portion of it,
either verbatim or with modifications and/or translated into another
language.  (Hereinafter, translation is included without limitation in
the term "modification".)  Each licensee is addressed as "you".

Activities other than copying, distribution and modification are not
covered by this License; they are outside its scope.  The act of
running the Program is not restricted, and the output from the Program
is covered only if its contents constitute a work based on the
Program (independent of having been made by running the Program).
Whether that is true depends on what the Program does.

  1. You may copy and distribute verbatim copies of the Program's
source code as you receive it, in any medium, provided that you
conspicuously and appropriately publish on each copy an appropriate
copyright notice and disclaimer of warranty; keep intact all the
notices that refer to this License and to the absence of any warranty;
and give any other recipients of the Program a copy of this License
along with the Program.

You may charge a fee for the physical act of transferring a copy, and
you may at your option offer warranty protection in exchange for a fee.

  2. You may modify your copy or copies of the Program or any portion
of it, thus forming a work based on the Program, and copy and
distribute such modifications or work under the terms of Section 1
above, provided that you also meet all of these conditions:

    a) You must cause the modified files to carry prominent notices
    stating that you changed the files and the date of any change.

    b) You must cause any work that you distribute or publish, that in
    whole or in part contains or is derived from the Program or any
    part thereof, to be licensed as a whole at no charge to all third
    parties under the terms of this License.

    c) If the modified program normally reads commands interactively
    when run, you must cause it, when started running for such
    interactive use in the most ordinary way, to print or display an
    announcement including an appropriate copyright notice and a
    notice that there is no warranty (or else, saying that you provide
    a warranty) and that users may redistribute the program under
    these conditions, and telling the user how to view a copy of this
    License.  (Exception: if the Program itself is interactive but
    does not normally print such an announcement, your work based on
    the Program is not required to print an announcement.)

These requirements apply to the modified work as a whole.  If
identifiable sections of that work are not derived from the Program,
and can be reasonably considered independent and separate works in
themselves, then this License, and its terms, do not apply to those
sections when you distribute them as separate works.  But when you
distribute the same sections as part of a whole which is a work based
on the Program, the distribution of the whole must be on the terms of
this License, whose permissions for other licensees extend to the
entire whole, and thus to each and every part regardless of who wrote it.

Thus, it is not the intent of this section to claim rights or contest
your rights to work written entirely by you; rather, the intent is to
exercise the right to control the distribution of derivative or
collective works based on the Program.

In addition, mere aggregation of another work not based on the Program
with the Program (or with a work based on the Program) on a volume of
a storage or distribution medium does not bring the other work under
the scope of this License.

  3. You may copy and distribute the Program (or a work based on it,
under Section 2) in object code or executable form under the terms of
Sections 1 and 2 above provided that you also do one of the following:

    a) Accompany it with the complete corresponding machine-readable
    source code, which must be distributed under the terms of Sections
    1 and 2 above on a medium customarily used for software interchange; or,

    b) Accompany it with a written offer, valid for at least three
    years, to give any third party, for a charge no more than your
    cost of physically performing source distribution, a complete
    machine-readable copy of the corresponding source code, to be
    distributed under the terms of Sections 1 and 2 above on a medium
    customarily used for software interchange; or,

    c) Accompany it with the information you received as to the offer
    to distribute corresponding source code.  (This alternative is
    allowed only for noncommercial distribution and only if you
    received the program in object code or executable form with such
    an offer, in accord with Subsection b above.)

The source code for a work means the preferred form of the work for
making modifications to it.  For an executable work, complete source
code means all the source code for all modules it contains, plus any
associated interface definition files, plus the scripts used to
control compilation and installation of the executable.  However, as a
special exception, the source code distributed need not include
anything that is normally distributed (in either source or binary
form) with the major components (compiler, kernel, and so on) of the
operating system on which the executable runs, unless that component
itself accompanies the executable.

If distribution of executable or object code is made by offering
access to copy from a designated place, then offering equivalent
access to copy the source code from the same place counts as
distribution of the source code, even though third parties are not
compelled to copy the source along with the object code.

  4. You may not copy, modify, sublicense, or distribute the Program
except as expressly provided under this License.  Any attempt
otherwise to copy, modify, sublicense or distribute the Program is
void, and will automatically terminate your rights under this License.
However, parties who have received copies, or rights, from you under
this License will not have their licenses terminated so long as such
parties remain in full compliance.

  5. You are not required to accept this License, since you have not
signed it.  However, nothing else grants you permission to modify or
distribute the Program or its derivative works.  These actions are
prohibited by law if you do not accept this License.  Therefore, by
modifying or distributing the Program (or any work based on the
Program), you indicate your acceptance of this License to do so, and
all its terms and conditions for copying, distributing or modifying
the Program or works based on it.

  6. Each time you redistribute the Program (or any work based on the
Program), the recipient automatically receives a license from the
original licensor to copy, distribute or modify the Program subject to
these terms and conditions.  You may not impose any further
restrictions on the recipients' exercise of the rights granted herein.
You are not responsible for enforcing compliance by third parties to
this License.

  7. If, as a consequence of a court judgment or allegation of patent
infringement or for any other reason (not limited to patent issues),
conditions are imposed on you (whether by court order, agreement or
otherwise) that contradict the conditions of this License, they do not
excuse you from the conditions of this License.  If you cannot
distribute so as to satisfy simultaneously your obligations under this
License and any other pertinent obligations, then as a consequence you
may not distribute the Program at all.  For example, if a patent
license would not permit royalty-free redistribution of the Program by
all those who receive copies directly or indirectly through you, then
the only way you could satisfy both it and this License would be to
refrain entirely from distribution of the Program.

If any portion of this section is held invalid or unenforceable under
any particular circumstance, the balance of the section is intended to
apply and the section as a whole is intended to apply in other
circumstances.

It is not the purpose of this section to induce you to infringe any
patents or other property right claims or to contest validity of any
such claims; this section has the sole purpose of protecting the
integrity of the free software distribution system, which is
implemented by public license practices.  Many people have made
generous contributions to the wide range of software distributed
through that system in reliance on consistent application of that
system; it is up to the author/donor to decide if he or she is willing
to distribute software through any other system and a licensee cannot
impose that choice.

This section is intended to make thoroughly clear what is believed to
be a consequence of the rest of this License.

  8. If the distribution and/or use of the Program is restricted in
certain countries either by patents or by copyrighted interfaces, the
original copyright holder who places the Program under this License
may add an explicit geographical distribution limitation excluding
those countries, so that distribution is permitted only in or among
countries not thus excluded.  In such case, this License incorporates
the limitation as if written in the body of this License.

  9. The Free Software Foundation may publish revised and/or new versions
of the General Public License from time to time.  Such new versions will
be similar in spirit to the present version, but may differ in detail to
address new problems or concerns.

Each version is given a distinguishing version number.  If the Program
specifies a version number of this License which applies to it and "any
later version", you have the option of following the terms and conditions
either of that version or of any later version published by the Free
Software Foundation.  If the Program does not specify a version number of
this License, you may choose any version ever published by the Free Software
Foundation.

  10. If you wish to incorporate parts of the Program into other free
programs whose distribution conditions are different, write to the author
to ask for permission.  For software which is copyrighted by the Free
Software Foundation, write to the Free Software Foundation; we sometimes
make exceptions for this.  Our decision will be guided by the two goals
of preserving the free status of all derivatives of our free software and
of promoting the sharing and reuse of software generally.

                            NO WARRANTY

  11. BECAUSE THE PROGRAM IS LICENSED FREE OF CHARGE, THERE IS NO WARRANTY
FOR THE PROGRAM, TO THE EXTENT PERMITTED BY APPLICABLE LAW.  EXCEPT WHEN
OTHERWISE STATED IN WRITING THE COPYRIGHT HOLDERS AND/OR OTHER PARTIES
PROVIDE THE PROGRAM "AS IS" WITHOUT WARRANTY OF ANY KIND, EITHER EXPRESSED
OR IMPLIED, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE.  THE ENTIRE RISK AS
TO THE QUALITY AND PERFORMANCE OF THE PROGRAM IS WITH YOU.  SHOULD THE
PROGRAM PROVE DEFECTIVE, YOU ASSUME THE COST OF ALL NECESSARY SERVICING,
REPAIR OR CORRECTION.

  12. IN NO EVENT UNLESS REQUIRED BY APPLICABLE LAW OR AGREED TO IN WRITING
WILL ANY COPYRIGHT HOLDER, OR ANY OTHER PARTY WHO MAY MODIFY AND/OR
REDISTRIBUTE THE PROGRAM AS PERMITTED ABOVE, BE LIABLE TO YOU FOR DAMAGES,
INCLUDING ANY GENERAL, SPECIAL, INCIDENTAL OR CONSEQUENTIAL DAMAGES ARISING
OUT OF THE USE OR INABILITY TO USE THE PROGRAM (INCLUDING BUT NOT LIMITED
TO LOSS OF DATA OR DATA BEING RENDERED INACCURATE OR LOSSES SUSTAINED BY
YOU OR THIRD PARTIES OR A FAILURE OF THE PROGRAM TO OPERATE WITH ANY OTHER
PROGRAMS), EVEN IF SUCH HOLDER OR OTHER PARTY HAS BEEN ADVISED OF THE
POSSIBILITY OF SUCH DAMAGES.

                     END OF TERMS AND CONDITIONS

            How to Apply These Terms to Your New Programs

  If you develop a new program, and you want it to be of the greatest
possible use to the public, the best way to achieve this is to make it
free software which everyone can redistribute and change under these terms.

  To do so, attach the following notices to the program.  It is safest
to attach them to the start of each source file to most effectively
convey the exclusion of warranty; and each file should have at least
the "copyright" line and a pointer to where the full notice is found.

    <one line to give the program's name and a brief idea of what it does.>
    Copyright (C) <year>  <name of author>

    This program is free software; you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation; either version 2 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License along
    with this program; if not, see <https://www.gnu.org/licenses/>.

Also add information on how to contact you by electronic and paper mail.

If the program is interactive, make it output a short notice like this
when it starts in an interactive mode:

    Gnomovision version 69, Copyright (C) year name of author
    Gnomovision comes with ABSOLUTELY NO WARRANTY; for details type `show w'.
    This is free software, and you are welcome to redistribute it
    under certain conditions; type `show c' for details.

The hypothetical commands `show w' and `show c' should show the appropriate
parts of the General Public License.  Of course, the commands you use may
be called something other than `show w' and `show c'; they could even be
mouse-clicks or menu items--whatever suits your program.

You should also get your employer (if you work as a programmer) or your
school, if any, to sign a "copyright disclaimer" for the program, if
necessary.  Here is a sample; alter the names:

  Yoyodyne, Inc., hereby disclaims all copyright interest in the program
  `Gnomovision' (which makes passes at compilers) written by James Hacker.

  <signature of Moe Ghoul>, 1 April 1989
  Moe Ghoul, President of Vice

This General Public License does not permit incorporating your program into
proprietary programs.  If your program is a subroutine library, you may
consider it more useful to permit linking proprietary applications with the
library.  If this is what you want to do, use the GNU Lesser General
Public License instead of this License.
*/
