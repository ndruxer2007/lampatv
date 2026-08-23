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
