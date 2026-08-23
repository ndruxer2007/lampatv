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
