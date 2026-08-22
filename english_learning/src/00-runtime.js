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
