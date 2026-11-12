# FM Scout: hosted browser version

Goal: open a Vercel URL, connect the game's save folder once, and search players
from the newest save. Saves are read inside the browser and never uploaded.

## What the spike proved

The save parser (fmsave 0.12.2) runs in the browser under Pyodide 314.0.7
(Python 3.14, which has zstd built in). On the Touch save it read 11,468
players, 251 nations, 5,187 clubs and the managed club in 2.5 s; cold start to
finished result was 4.6 s. This is the same method the parser's own web app uses.

## Design

One static site, no server and no build step. The local Python server is retired
so there is a single codebase; the site also runs locally from any static file
server.

| Concern | Decision |
|---|---|
| Parsing | A web worker loads Pyodide, installs fmsave and runs the existing dataset code (moved from `server.py` almost unchanged). The page stays responsive while it works. |
| fmsave delivery | The pinned wheel is vendored in the repo with its MIT licence and checked by SHA-256 before install. No runtime call to PyPI. |
| Pyodide delivery | Loaded from jsDelivr at a pinned version. |
| Nation names | `nations.json` (245 names and codes) generated once from the installed game by a script kept in the repo. |
| Save loading | First visit: a "Connect your save folder" screen with the path to paste. The folder handle is stored in the browser (IndexedDB); later visits need one click to re-grant access, then list saves and load the newest. |
| Fallback | Where folder access is unavailable or refused: choose or drag in a single `.fmv` file. Works in every browser. |
| Shortlist | Stored in the browser (localStorage), with export and import as a JSON file so it can move between browsers. |
| Security headers | Content-Security-Policy limited to the site itself and the pinned Pyodide CDN; no third-party fonts or analytics. |

## Files

```whitelist
web/index.html
web/app.js
web/styles.css
web/worker.js
web/reader.py
web/nations.json
web/vendor/fmsave-0.12.2-py3-none-any.whl
web/vendor/FMSAVE-LICENSE
scripts/extract_nations.py
tests/test_reader.py
vercel.json
README.md
LICENSE
.gitignore
server.py
static/index.html
```

`server.py` and `static/index.html` are deleted; their logic moves to
`web/reader.py`, `web/app.js`, `web/styles.css` and `web/index.html`.
Not committed: `.venv/`, `saves/`, `data/`, `.agent/`, `.claude/`.

## Order of work

1. Move the dataset code into `web/reader.py`; test it under the local Python
   against the sample save (test skips when no save is present).
2. Worker and page: load, parse, render the existing UI from the worker's result.
3. Save-folder connect flow, remembered handle, save list, reload; file fallback.
4. Shortlist in browser storage with export and import.
5. Browser test of every flow that exists today (filters, quick searches,
   attribute picker, profile, similar players, shortlist).
6. `git init`, public repo `eddieyip831/fm-scout`, first push.
7. Vercel project linked to the repo; deploy; test the live URL.

## Risks

- **Chrome may refuse the save folder.** Chrome blocks some system folders from
  folder access, and the save folder is under `~/Library`. Untested: it needs a
  real click in your Chrome. If refused, the file fallback becomes the main flow
  and "newest save, one click" is lost.
- **Folder access is Chromium-only as far as I know** (Chrome, Edge). Per-browser
  support was not confirmed from documentation. Safari and Firefox get the file
  fallback.
- **Game updates** can still break parsing until fmsave catches up; the vendored
  wheel is then updated by replacing one file and its hash.
- **The Vercel URL is public.** The site contains no save data, only the tool
  and the nation list.
- **Shortlist is per browser** unless exported.

## Done when

The live Vercel URL loads the newest save from the connected folder (or a chosen
file), and every feature of today's local version works there.
