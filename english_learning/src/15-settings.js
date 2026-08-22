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
