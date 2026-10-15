# Floss Ledger

A small React dashboard for cataloging and tracking your DMC thread supply, matching it against cross-stitch projects, and building shopping lists. Everything runs in the browser; data is stored in `localStorage` with backup and restore.

## Features

- **Add:** search by DMC number, name or color family; record whole skeins, partial skeins (¼, ½, ¾), an optional minimum to keep on hand, and an optional project to reserve for. Bulk add by pasting codes (`310, 666 x2, 797:3`).
- **Supply:** search, filter (in stock, partial, reserved, low, used up, conflict), sort, and edit. Assign to projects, mark a skein partial, mark used up, mark a reservation as used.
- **Projects:** create manually or import a FlossCross `.fcjson` chart. Stitch counts per color become skein estimates (fabric count 14/16/18/custom, strands, waste buffer). Matches against supply, reserves what you have, and builds a shopping sublist for the shortfall. Planned / In progress / Completed; completing offers to deduct reserved skeins or release them.
- **Shopping:** a General list plus project sublists. Editable quantities and notes, check-off (optionally adds to supply), copy and CSV export.
- **Overview:** thread wall of everything you own, totals, low-stock and conflict warnings (two projects competing for the same skeins).
- **Data:** JSON backup/restore, CSV export, dark mode, defaults, custom colors and catalog import.
- Mobile layout with a bottom tab bar. Brand-agnostic keys (`Brand:Code`), so other brands can be added as custom colors.

## Run it

```bash
npm install
npm run dev      # local dev server
npm test         # unit tests (node:test)
npm run build    # production build in dist/
```

## Deploy to GitHub Pages

1. Push this folder to a GitHub repo on the `main` branch.
2. In the repo, go to **Settings → Pages** and set **Source** to **GitHub Actions**.
3. Push again (or run the workflow manually). The included workflow in `.github/workflows/deploy.yml` tests, builds and publishes `dist/`.

The build uses relative asset paths and hash-based routing, so it works at `https://<user>.github.io/<repo>/` without extra config.

## Things to know

- **The bundled DMC list is approximate.** `src/data/dmc.json` (453 colors) was typed in by hand, not copied from a published dataset. Names and hex values may contain errors, and most colors numbered below 150 other than 01 are missing, as are the Light Effects (E-series) and variegated threads. Fix or extend it in the app under **Data → Color catalog** (custom entries override built-in ones), or replace `dmc.json` with a vetted dataset. Colors found in imported charts that are not in the catalog are added automatically using the file's name and color.
- **Skein estimates are estimates.** See `src/lib/skeins.js` for the assumptions. Adjust the waste buffer after a project or two.
- **FlossCross import** was built against one real v133 export. Backstitch data was empty in that sample, so its structure is unverified; other stitch types are counted as full stitches and flagged with a warning.
- **Data is per browser.** Clearing site data erases it. Use **Data → Download backup** regularly.
