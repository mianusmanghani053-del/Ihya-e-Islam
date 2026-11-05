# Audio Quran

**Status: catalogue imported and verified, ready to deploy.**

The fourth Quran tab (`#quran/audio`) has four category routes, a searchable reciter directory, recording lists and a persistent audio player (next/previous, repeat, speed). Text Quran tabs are unchanged.

## Data

`public/data/audio-quran/` was generated from the public QuranicAudio.com API:

- `catalogue.json`: 177 reciters (Recitations 109, Haramain Taraweeh 47, Non-Hafs 10, With translations 11).
- `reciter-<id>.json`: 19,125 recordings. Surah titles come from `/api/surahs`. Durations are shown only where the source value is plausible.
- `provenance.json`: source, API endpoints, import time, the source's terms of use, and the verification report.

Recordings are **streamed from `download.quranicaudio.com`**, not copied. Reciter names, Arabic names and descriptions are kept as published. Incomplete collections keep their real track counts; no tracks are invented. Duplicate source entries are removed.

## Verification

- Every reciter's first, middle and last recording was range-requested.
- Two reciters (42, 61) list stale file names; their recordings were repaired to the working `NNN.mp3` names after confirming each one plays.
- Nothing was dropped.
- The audio host returns `audio/mpeg` with `206` range responses and open CORS.

## Terms

QuranicAudio.com says its MP3s "may be downloaded and used for personal use free of charge" and must not be used commercially. Ihya-e-Islam streams them free, with credit and without sale. The trust should confirm it is comfortable with this, or obtain permission, and keep the credit visible.

## Refreshing

The importer and verifier live outside the repo (one-off). Re-run them against the same API to refresh. Keep `www.quranicaudio.com`, `quranicaudio.com` and `download.quranicaudio.com` in the CSP `media-src` and the session network allow-list.
