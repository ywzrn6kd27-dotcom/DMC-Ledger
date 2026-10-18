# Floss Ledger

A small React dashboard for cataloging and tracking your DMC thread supply, matching it against cross-stitch projects, and building shopping lists. Everything runs in the browser; data is stored in `localStorage` with backup and restore.

## Features

- **Add:** search by DMC number, name or color family, or tap **Browse** to scroll the whole catalog (filters, owned counts, jump bar, select several). Record whole skeins, partial skeins (¼, ½, ¾), an optional minimum, and an optional project to reserve for. Codes not in the catalog can be added on the spot, including multicolor (variegated) skeins with a gradient swatch. Bulk add by pasting codes (`310, 666 x2, 797:3`) opens a **review step** first: known colors, codes that need details, and text it could not read.
- **Supply:** search, filter (in stock, partial, reserved, low, used up, conflict), sort, and edit. Assign to projects, mark a skein partial, mark used up, mark a reservation as used.
- **Projects:** create manually or import a chart: FlossCross `.fcjson`, OXS `.oxs` (MacStitch, FlossCross and others), or a pattern **PDF**. Stitch counts per color become skein estimates (fabric count 14/16/18/custom, strands, waste buffer). Matches against supply, reserves what you have, and builds a shopping sublist for the shortfall. Planned / In progress / Completed; completing offers to deduct reserved skeins or release them.
- **Shopping:** three sub tabs. **All floss** is one master list: a row per color with the total needed across every active project, what you own and how many to buy (tap a row to see which projects need it; "Mark bought" adds the skeins to supply). **By list** has the General list plus project sublists. **Other supplies** tracks fabric, needles, hoops and anything else by category, optionally linked to a project. Copy and CSV export include both.
- **Fabric size:** each project suggests fabric sizes for 14/16/18 count (and your custom count) from the pattern size plus a margin, with one tap to add it to Other supplies. Pattern size is filled in from imports and editable.
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
- **OXS import** was built against one real OXS 1.0 file that had only full stitches. Part stitches, backstitch and knots are read from the OXS layout as documented and flagged as unverified when present. OXS files do not name the thread brand, so codes are treated as DMC unless they start with another brand name.
- **PDF import** reads the thread key (code and name per color) and, when the designer includes it, the per-color skein estimate. Stitch counts per color are not read from the chart pages, so those skein amounts are the designer's and do not change with fabric count. Layouts vary between designers, so every PDF import goes through a review screen. Scanned or image-only PDFs have no text and cannot be read. The PDF reader (pdf.js 5.6.205) is loaded on demand from the jsDelivr CDN the first time you import a PDF, so that needs an internet connection; the rest of the app works offline.
- **Old data is repaired on load.** Codes saved under a different spelling (FlossCross's `BLANC` for DMC `White`) are merged into the catalog code automatically.
- **Data is per browser.** Clearing site data erases it. Use **Data → Download backup** regularly.

## Updating the live site

Replace the changed files in your repo and push to `main`; the workflow rebuilds and redeploys. Data stored in each browser is kept.
