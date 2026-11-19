# Labelina

A label studio for parts storage: fasteners, electronics, drawers and bins (Gridfinity included). It runs entirely client-side; there is no backend and no database.

It comes two ways from the same code:

- **Desktop app (Windows)**: install it and print straight to a Brother P-touch over USB or Bluetooth. No browser, no driver changes, and it reconnects to your printer automatically. See [Desktop app](#desktop-app).
- **Web page**: serve the folder from any static host. Design and exports work in every browser; direct printing needs Chrome or Edge.

## Features

- **Parts library** with generators for screws and bolts (15 head types, 7 drives, metric and UNC/UNF, coarse/fine pitch, standard lengths per size, key/wrench sizes, ISO/DIN numbers), nuts, washers (with ID × OD × thickness), threaded inserts, standoffs, pins, clips and rivets. Electronics: resistors (E-series ranges, colour bands, SMD codes), capacitors (marking codes), inductors, diodes, transistors, ICs, regulators, LEDs, connectors, pin headers, wire, heat shrink, crystals, fuses, switches and batteries. Pick several sizes and lengths to generate a whole set of labels at once.
- **About 90 built-in icons**, including head profiles and drive symbols, plus uploaded images.
- **Media**: Brother P-touch TZe tape (3.5–24 mm) in standard 180 × 180 dpi or **HD 180 × 360 dpi**, Brother HSe heat-shrink tube (2:1 and 3:1, nine sizes), Brother QL rolls, Dymo LabelWriter, 203 dpi thermal labels, label sheets (A4/Letter templates) and custom sizes. Tape length can fit the content, be fixed, follow grid units (42 mm Gridfinity by default), or use a **length preset**: SLICC 33 mm and 63 mm (cut at exactly that length with the smallest margins the printer allows) plus common lengths.
- **Codes**: QR, Code 128, Code 39, EAN-13 and UPC-A. Modules are snapped to whole printer dots.
- **Exports**: PDF sheet, PDF per label, PNG (printer-exact 1-bit with correct DPI metadata), PNG set (.zip), SVG, SVG set (.zip), ZPL, P-touch raster job (.bin) and CSV. Projects save and load as JSON and auto-save in the browser.
- **Direct printing** to Brother P-touch tape printers (PT-D610BT and relatives) over WebUSB or Bluetooth via Web Serial.

## Run it locally

ES modules don't load from `file://`, so serve the folder:

On Windows, double-click `start-studio.cmd`. Otherwise:

```sh
git clone https://github.com/bennibeatnik/Labelina.git
cd Labelina
python -m http.server 8000
# open http://localhost:8000
```

## Host it

Copy the whole folder to any static host (nginx, Apache, Caddy, GitHub Pages, Netlify, Cloudflare Pages, S3). No configuration is needed beyond serving `.js` as `text/javascript`, which every common server does by default.

- **Serve it over HTTPS.** WebUSB and Web Serial only work in a secure context (HTTPS or `localhost`).
- **No third-party requests**: fonts and the four libraries (qrcode-generator 1.4.4, JsBarcode 3.11.6, jsPDF 2.5.1, JSZip 3.10.1) are self-hosted in `vendor/`. The only outside link is inside exported SVG files, which point at Google Fonts so other programs can render the chosen font (`fontCssUrl()` in `js/app.js`).

## Desktop app

`desktop/` wraps the studio in [Tauri](https://tauri.app). It shows the same pages in WebView2, which is built into Windows 10 and 11, and adds a small Rust backend (`desktop/src-tauri/src/printer.rs`) for printing:

- **USB**: jobs go through the Windows print queue as raw data, so Brother's own driver passes them to the printer. No Zadig/WinUSB swap, and P-touch Editor keeps working. The print queue can't report back, so the loaded tape can't be read over USB.
- **Bluetooth**: paired printers are listed by name (for example *PT-D610BT1200 · Bluetooth · COM5*). The port stays open between prints and is reopened automatically if the printer slept or was switched off. The tape width and colour are read on connect.
- The last printer is remembered and reconnected when the app starts. Exports open a normal Save dialog.

Build it (needs Node 18+ and Rust with the MSVC toolchain):

```sh
cd desktop
npm install
npm run dev     # run from source
npm run build   # installers in desktop/src-tauri/target/release/bundle/ (nsis .exe and .msi)
```

The build copies `index.html`, `css/`, `js/` and `vendor/` into `desktop/dist`, so edit the files at the repo root, not the copy. To list the printers the app can see without printing anything: `cd desktop/src-tauri && cargo test -- --ignored --nocapture`.

## Direct printing notes

These notes are for the web page. The desktop app avoids the browser and driver limits.

- Printing works in **Chrome or Edge on desktop** only. Safari and Firefox don't support WebUSB or Web Serial, though every export still works in them.
- **Bluetooth**: pair the printer in the operating system first. On Windows it then shows up as a COM port in the browser's port picker.
- **USB on Windows**: the Brother driver claims the device, so the browser can't open it. Use Bluetooth, or switch the printer's driver to WinUSB with Zadig (Brother's own software won't see it until you switch back). On Linux, ChromeOS and macOS, USB usually works without this step.
- The raster commands follow Brother's published reference for the 128-pin, 180 dpi tape printers (PT-E550W/P750W/P710BT). The D610BT uses the same head, but **this hasn't been tested on real hardware yet**. Print the *Test label* first; if the text comes out upside down or mirrored, tick *Flip* or *Mirror*.
- If your model has no automatic cutter, use *One strip with cut marks* and cut along the dashed lines.

## Tape geometry (Brother 128-pin printers)

From Brother's Raster Command Reference for the PT-E550W/P750W/P710BT, which share the D610BT's print head:

- **Across the tape** the head prints at most 128 dots (18.1 mm), so 24 mm tape keeps about 3 mm unprinted at each edge. Each tape's print area is in `js/media.js`.
- **Along the tape** every label gets a feed margin at each end. **2 mm is the printer's minimum** (14 dots at 180 dpi, 28 at 360 dpi); smaller values are raised to 2 mm, and fixed lengths include both margins, so a 33 mm label is 2 + 29 + 2 mm.
- The printer feeds out **at least 24.5 mm** per piece, and the first label of a run carries roughly 24 mm of leader because the cutter sits ahead of the print head. Chain printing avoids the leader on the next run, but leaves the last label in the printer until then.
- **HD** (ESC i K bit 6) doubles the resolution along the tape only. Layout runs on a 360 dpi grid and pairs of rows are merged into one printer dot; QR modules are kept to even sizes so they stay square. HD is for TZe tape only.

## Project layout

```
index.html          markup
css/studio.css      styles (light and dark)
js/app.js           state, UI, printing and export wiring
js/render.js        layout engine, canvas/SVG renderers, 1-bit conversion
js/library.js       parts library generators (form fields + build functions)
js/fasteners.js     thread tables, head types, standards, dimensions
js/electronics.js   E-series, colour codes, part presets
js/icons.js         icon library (24 × 24 path data)
js/media.js         media profiles and sheet templates
js/codes.js         QR / barcode encoding
js/ptouch.js        Brother raster protocol + WebUSB / Web Serial / desktop transports
js/exporters.js     PNG, PDF, ZPL, ZIP, CSV
vendor/             self-hosted libraries and fonts
tests/selftest.html renders every category on every media and runs every exporter
desktop/            Tauri desktop app (Rust printer backend in src-tauri/src/printer.rs)
```

## Extending

- **New library category**: add an object to `CATEGORIES` in `js/library.js` with `fields` (types `select`, `chips`, `text`, `textarea`, `check`, `icon`) and a `build(values)` that returns `{ lines: [l1, l2, l3], icon, icon2 }` rows.
- **New icon**: add an entry to `ICONS` in `js/icons.js`. Parts are SVG path strings on a 24 × 24 grid: `f` fill, `e` even-odd fill, `s` stroke, `d` dashed stroke, `w`/`wf` knock-out in the paper colour.
- **New media or sheet template**: add an entry to `MEDIA` in `js/media.js`.

After changes, open `/tests/selftest.html`; it should end with `DONE`.

Fastener dimensions are nominal values from the named standards. Check a supplier's datasheet before relying on them for engineering work.
