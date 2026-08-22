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
