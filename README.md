# mtgtop8-topcards

MTGTOP8 staple-card JSON snapshots plus a static web explorer for filtering and sorting.

View on https://suppennudel.github.io/mtgtop8-topcards/

## Web explorer

This repository now includes a GitHub Pages-ready static site:

- `index.html`
- `styles.css`
- `app.js`

The page loads these files directly from the repository root:

- `Standard.json`
- `Pioneer.json`
- `Modern.json`
- `Legacy.json`
- `Pauper.json`

Features:

- Format selector
- Card-name search
- Board filter (mainboard/sideboard/both/either)
- Numeric filters (minimum deck share and average copies)
- Sortable columns
- Per-card Scryfall link
- Card image hover previews via Scryfall API

## Daily data updates

The `update_topcards.sh` script refreshes all five formats and pushes changed
JSON files. The scheduled job runs daily at 02:00; its output is appended to
`update_topcards.log`.

Set up the Python environment expected by the updater with:

```sh
python3 -m venv /home/rohmce/myenv
/home/rohmce/myenv/bin/pip install -r /home/rohmce/mtgtop8-topcards/requirements.txt
```

The updater imports the sibling `mtgtop8_python` package from `/home/rohmce`.
The environment can be overridden by setting `PYTHON_BIN` when invoking the
script.
