/* SPDX-License-Identifier: GPL-2.0-only */
    function finite(value, fallback) { value = Number(value); return isFinite(value) ? value : fallback; }
    function clamp(value, low, high) { return Math.max(low, Math.min(high, value)); }
    function SubtitleLayoutPolicy() {}
    SubtitleLayoutPolicy.compute = function (options) {
        var height = Math.max(0, finite(options && options.height, 0));
        var width = Math.max(0, finite(options && options.width, 0));
        var controlsVisible = !!(options && options.controlsVisible);
        var russianVisible = !!(options && options.russianVisible);
        var requested = clamp(Math.round(finite(options && options.requestedSize, 56)), 18, 72);
        var compact = height > 0 && height < 360;
        var paddingY = compact ? 4 : 12;
        var gap = russianVisible ? (compact ? 4 : 10) : 0;
        var cap = height > 0 ? Math.floor(height * (controlsVisible ? 0.36 : 0.42)) : 0;
        var factor = 1.15 + (russianVisible ? 0.72 * 1.18 : 0);
        var available = cap > 0 ? cap - paddingY * 2 - gap : 0;
        var effective = requested;
        if (cap > 0 && effective * factor > available) effective = clamp(Math.floor(available / factor), 18, requested);
        while (cap > 0 && effective > 18 && effective * 1.15 + (russianVisible ? Math.max(13, Math.round(effective * 0.72)) * 1.18 : 0) + gap + paddingY * 2 > cap) effective--;
        return {
            requestedEnglishSizePx: requested,
            effectiveEnglishSizePx: effective,
            effectiveRussianSizePx: Math.max(13, Math.round(effective * 0.72)),
            englishLineHeight: 1.15,
            russianLineHeight: 1.18,
            gapPx: gap,
            paddingYPx: paddingY,
            paddingXPx: compact ? 8 : 20,
            maxHeightPx: cap,
            maxWidthPx: width > 0 ? Math.min(1600, Math.floor(width * 0.88)) : 1600,
            bottom: controlsVisible ? '20%' : '6%'
        };
    };
    root[namespace].SubtitleLayoutPolicy = SubtitleLayoutPolicy;
