# FM Scout

Search, filter and compare the players in your own Football Manager save.

The save is read **inside your browser**. Nothing is uploaded; the site is static
files only.

Unofficial fan project. Not affiliated with Sports Interactive or SEGA.

## What it does

- Lists every player in a save with ability, potential, value, wage and contract.
- Filters by name, club, nationality, gender, position, age, ability, value, wage,
  contract end and any of the 52 attributes.
- Quick searches: best players by position, wonderkids, bargains, free agents,
  expiring contracts.
- Player profile: skill radar, role suitability, strengths and weaknesses, full
  attributes, and a "find similar players" search.
- Shortlist kept in your browser, with export and import.

Role scores, strength tags and the similarity measure are this tool's own plain
averages of attributes. They are not the game's figures.

## Loading a save

Football Manager Touch on a Mac keeps local saves in:

```
~/Library/Containers/com.sega.soccer.manager.23/Data/Library/Application Support/local_backups
```

- **Chrome or Edge:** choose "Connect save folder" once. The browser remembers
  the folder; later visits need one click to grant access again, then the newest
  save loads.
- **Any browser:** choose a `.fmv` file, or drag one onto the page.

## How it works

`web/worker.js` runs [Pyodide](https://pyodide.org) (Python in WebAssembly) in a
web worker and reads the save with [fmsave](https://github.com/rhiever/fmsave),
an MIT-licensed reader. `web/reader.py` shapes the result for the page.

- Pyodide is loaded from jsDelivr at a pinned version.
- The fmsave wheel is vendored in `web/vendor/` with its licence and verified by
  SHA-256 before it is installed. To update it, replace the wheel and change
  `WHEEL` and `WHEEL_SHA256` in `web/worker.js`.
- `web/nations.json` maps the game's nation ids to names. Regenerate it from an
  installed game with `scripts/extract_nations.py`.

A game update can change the save format before fmsave supports it; the page
then reports that it could not read the save.

## Run locally

```bash
python3 -m http.server 8765 --bind 127.0.0.1 --directory web
```

Then open http://localhost:8765.

## Tests

```bash
python3 -m venv .venv
.venv/bin/pip install fmsave==0.12.2
.venv/bin/python -m unittest discover tests
```

Tests that need a real save skip unless one is present in `saves/` (ignored by git).

## Deploy

The repository deploys to Vercel as a static site; `vercel.json` serves `web/`
and sets the security headers.

## Licence

MIT; see [LICENSE](LICENSE). The bundled fmsave reader is also MIT; its licence
is in `web/vendor/FMSAVE-LICENSE`.
