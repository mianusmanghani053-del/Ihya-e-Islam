# Audio Quran implementation status

Prepared, not deployed. The fourth Quran tab, four category routes, searchable reciter directory, recording list and persistent native audio player are implemented in `public/audio-quran.mjs` and its stylesheet. The player supports next/previous, repeat, playback speed, source links and safe error handling. Existing text Quran tabs remain available. Page branding is Audio Quran; reciter and necessary recording credits must be retained.

`tests/audio-quran-browser.py` verifies the UI with explicitly isolated local fixtures. Those fixtures are not production reciters or recordings and must not be published as the full catalogue.

## Blocking source import

The current environment network policy excludes the source site. A configuration draft was saved adding `quranicaudio.com`, `www.quranicaudio.com`, `api.quranicaudio.com`, and `download.quranicaudio.com` while preserving all existing custom hosts and package-manager presets. The tool returned `requires_publish: true`; the user must review/save/publish it. Do not bypass the network proxy or claim actual audio playback has been verified before those hosts are accessible.

After activation, inspect the website, its public catalogue API, source terms/credits and recording metadata. Import its complete four-category catalogue into `public/data/audio-quran/catalogue.json`, per-reciter track lists into `reciter-ID.json`, and provenance into `provenance.json`. Do not fabricate 114 available tracks for incomplete collections. Retain original recording URLs and credits; stream audio from the permitted host rather than copying recording archives into Git.

Frontend contract:

- Catalogue: `{reciters:[{id:number,name,arabicName,category,trackCount,description?,reading?}]}`.
- Categories: `recitations`, `haramain`, `non-hafs`, `translations`.
- Per-reciter: `{reciter:number,tracks:[{id:string,surah?:number,title,url,duration?}]}`.
- Validate every published recording URL and source category; safely handle missing recordings.
- Real catalogue JSON files have not yet been generated; do not deploy an empty or fixture catalogue.

Then validate catalogue coverage, real media responses/range support, four category parity, mobile behavior and existing workflows. Run build/tests, commit/merge and deploy the finished feature only after actual data is available. Update the application script version to avoid stale module graphs on the live site.
