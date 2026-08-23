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
