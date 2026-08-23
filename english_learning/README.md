# English Learning for Lampa

`english_learning.js` is a client-side dual-subtitle learning plugin for Lampa.
Version 0.2.0 targets Samsung QE-65Q90TAU (Q90T, 2020; Tizen 5.5 /
Chromium M69), but physical-TV behaviour still requires manual acceptance.

The plugin is independent of `online_mod.js`. It does not choose a video
source, contact a subtitle provider, or invent subtitle URLs. When enabled, it
uses only English and Russian subtitle tracks already present in the current
Lampa player data.

## Install

Add this public raw URL to Lampa:

`https://raw.githubusercontent.com/ndruxer2007/lampatv/main/english_learning.js`

Open the **English Learning** settings component and enable learning subtitles.
The setting is persisted. Learning mode itself remains disabled by default.

## Playback and appearance

- English is visually primary in warm amber `#FFD166`; Russian is white
  `#F5F5F5` at 72% of the English size. Both use a multi-layer dark shadow and
  are rendered through `textContent`.
- Subtitle-size presets are 24, 28, 32, 40, 48, 56, 64, and 72 CSS px. New
  installations default to 56 px. A valid saved value is preserved; legacy
  installations without a saved font retain the earlier 28 px default. The
  direct `EnglishLearning.configure()` value is clamped to 18–72 px.
- **Subtitle backdrop** defaults to Off. Soft and Contrast add opt-in,
  content-sized local plaques; the plugin never adds a permanent full-width or
  full-screen dim layer.
- The effective displayed size and visible history count may be reduced on a
  small viewport. Long wrapped text is clipped inside safe bounds instead of
  covering player controls. If pause history cannot fit above the current
  subtitle plaque, history is hidden.
- English and Russian offsets are independent. The UI offers ±3 seconds; the
  direct configure API safely clamps values to ±30 seconds.

On a supported desktop player-panel contract, a separate native-looking
`EL: On/Off` selector is inserted beside Lampa's subtitle button. It uses the
same persisted enabled setting and applies immediately. It is not a subtitle
track and is not inserted inside the stock subtitle Select. The adapter is
fail-closed: if the exact pinned PlayerPanel DOM, jQuery `on/off`, TV-visible
subtitle anchor, or `.selector` integration conditions are absent (including
unsupported mobile-more layouts), no button is added and the ordinary English
Learning settings remain available. Dynamic controller collection/focus has
automated proxy coverage; real Samsung focus, OK, and Back remain manual checks.

## Pause context

**Context on pause** defaults to On. A source-confirmed public PlayerVideo
pause event shows up to four newest previous English/Russian cue pairs from the preceding
90 seconds in chronological order. The active cue stays in the bottom plaque
and is excluded from history. A pause within 2500 ms after a cue treats that cue
as the current bottom pair; beyond that grace period there is no synthetic
current cue. Resume hides the context, and a meaningful seek while paused
rebuilds it from the new public time anchor.

The context panel is noninteractive, `aria-hidden`, pointer-transparent, and
uses only the plugin's own overlay geometry. It never queries or patches native
subtitle DOM. Disable, external playback, session teardown, and bundle
re-evaluation clear its DOM, timers, listeners, and repeat state.

## Repeat and remote limitation

During an active English cue, Samsung red key code `403` seeks to the cue start
minus the selected lead-in (0, 300, or 1000 ms) through public
`PlayerVideo.to()`, which resumes playback. A key is consumed only after a
repeat succeeds; Back, Play/Pause, arrows, OK, and unrelated keys remain with
Lampa.

Samsung colour keys may require Tizen `tv.inputdevice` privilege and
`registerKey()`. A hosted plugin must not take ownership of that registration,
so this plugin does not register Tizen keys. If Lampa does not emit code `403`,
repeat is a safe no-op.

## Native subtitles

Turn Lampa's native subtitle track **Off** while using English Learning. The
plugin deliberately does not disable or restore native subtitles: the inspected
Lampa contract provides no safe reversible public API for that operation. If a
native track remains enabled, it can appear as a third overlapping subtitle
layer.

## Development and corresponding source

The public release contains the generated root bundle and complete
corresponding source under `english_learning/`: all `src/` modules, scripts,
tests, the code-native fixture, `VERSION`, `build-order.json`, README, and the
full GPLv2 license.

```text
node english_learning/scripts/build.mjs
node english_learning/scripts/test.mjs
```

The build is deterministic and the sequential canonical runner uses Node
built-ins only. Edit source modules, not the generated root bundle.

## Privacy, security, and acceptance limitations

- No account, backend, analytics, cloud sync, bundled subtitle data, or
  third-party subtitle API is included.
- Subtitle URLs and text are never persisted or logged.
- Subtitle text uses `textContent`; runtime source contains no `innerHTML` or
  `eval` path.
- Loading uses browser `fetch` against tracks already selected from Lampa
  player data. CORS, provider formats, network access, and fetch support remain
  external constraints; failures degrade quietly.
- Automated tests cover settings migration, fail-closed panel integration,
  pause/play/seek proxies, XSS-shaped text, stale loads, small/TV geometry,
  controls mutations, disabled cleanup, re-evaluation, and repeated sessions.
- These checks do not prove real Samsung behaviour. QE-65Q90TAU focus/OK/Back,
  pause-event ordering and seek while paused, real overlay/control geometry,
  subtitle CORS, red key 403 delivery, AVPlay seek, and final visual readability
  remain manual acceptance items.

## License

The source and generated bundle are GPL-2.0-only. See [LICENSE](LICENSE). No
third-party code or artwork is copied into this release.
