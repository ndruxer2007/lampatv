# English Learning for Lampa

`english_learning.js` is a small, client-side learning plugin for Lampa. It is
an MVP targeted at Samsung QE-65Q90TAU (Q90T, 2020; Tizen 5.5 / Chromium M69),
written as ES5-compatible browser code. Physical-TV behaviour still requires
manual acceptance.

It is separate from `online_mod.js`: it never chooses a video source, starts a
player, contacts Ororo, or supplies subtitle URLs. When enabled, it considers
only subtitle tracks already present in the current Lampa player data, renders
the selected English cue and optionally Russian cue, and can repeat the active
English cue.

## Install and use

1. In Lampa, add this plugin URL:

   `https://raw.githubusercontent.com/ndruxer2007/lampatv/main/english_learning.js`

2. Open the **English Learning** settings component and enable learning mode.
3. Select whether Russian text is shown and adjust independent English/Russian
   timing offsets in the settings UI (up to plus or minus 3 seconds). The direct
   `EnglishLearning.configure()` API accepts offsets up to plus or minus 30
   seconds for development/integration use. The plugin automatically favours
   ordinary EN and RU tracks and avoids commentary/dubbing labels.
4. During an active English cue, press the Samsung red colour key. Its Lampa
   keypad code is `403`; it seeks to the cue start minus the configured lead-in
   (0 ms, 300 ms, or 1 second) and resumes playback.

Learning mode and diagnostics are disabled by default. The subtitle overlay is
not focusable and uses only `textContent`; it is removed immediately when the
feature is disabled or the playback session ends. Diagnostics are an opt-in
helper and are hidden while normal player controls are hidden.

## Important remote limitation

The plugin consumes a key only after a repeat actually succeeds. It leaves Back,
Play/Pause, arrows, OK, and all unrelated keys to Lampa. Samsung colour keys may
need Tizen `tv.inputdevice` privilege plus `registerKey()` before a web app sees
them. A hosted Lampa plugin must not take ownership of that registration, so this
plugin does **not** register Tizen keys. On the target TV, first confirm that
Lampa already emits key code `403`; otherwise the red key is a safe no-op.

## Development and corresponding source

The public release includes this generated bundle and its corresponding source
in `english_learning/`: `src/`, deterministic build script, tests, fixtures,
version, build order, README, and full license text. Edit source files only;
never edit the generated root bundle by hand.

```text
node english_learning/scripts/build.mjs
node english_learning/scripts/test.mjs
```

The canonical test runner is sequential because its build test rewrites the
shared generated bundle. It uses Node built-ins only; no packages are needed.

## Privacy, security, and limitations

- No account, backend, analytics, or cloud synchronisation is used.
- Subtitle URLs and subtitle text are not persisted or logged by the plugin.
- User-controlled subtitle text is inserted with `textContent`, never HTML.
- Loading uses browser `fetch` against the already selected Lampa track URL.
  CORS, network availability, provider formats, and fetch support on a real
  Tizen Lampa deployment are external constraints; failed or malformed loads
  degrade quietly.
- This repository has automated fake-DOM checks for disabled mode, controls
  visible/hidden placement, small viewport styling, cleanup, errors, stale
  loads, and repeated episodes. It does not replace a real Lampa or television
  test. Physical QE-65Q90TAU/Tizen behaviour, actual subtitle CORS, AVPlay seek,
  and a browser screenshot have not yet been verified.

## License

The plugin source and generated bundle are GPL-2.0-only. See [LICENSE](LICENSE).
No third-party subtitle service, API, code, catalogue, or subtitle data is
included.
