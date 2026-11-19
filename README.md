# Labelina

A browser-based label studio for parts storage: fasteners, electronics, drawers and bins (Gridfinity included). It runs entirely client-side; there is no backend, no build step and no database.

## Features

- **Parts library** with generators for screws and bolts (15 head types, 7 drives, metric and UNC/UNF, coarse/fine pitch, standard lengths per size, key/wrench sizes, ISO/DIN numbers), nuts, washers (with ID × OD × thickness), threaded inserts, standoffs, pins, clips and rivets. Electronics: resistors (E-series ranges, colour bands, SMD codes), capacitors (marking codes), inductors, diodes, transistors, ICs, regulators, LEDs, connectors, pin headers, wire, heat shrink, crystals, fuses, switches and batteries. Pick several sizes and lengths to generate a whole set of labels at once.
- **About 90 built-in icons**, including head profiles and drive symbols, plus uploaded images.
- **Media**: Brother P-touch TZe tape (3.5–24 mm, 180 dpi), Brother QL rolls, Dymo LabelWriter, 203 dpi thermal labels, label sheets (A4/Letter templates) and custom sizes. Tape length can fit the content, be fixed, or follow grid units (42 mm Gridfinity by default).
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
- **Third-party requests**: the page loads fonts from Google Fonts and four libraries from cdnjs (qrcode-generator, JsBarcode, jsPDF, JSZip). If you need to avoid third-party requests (for example under GDPR), download those files, put them in a `vendor/` folder and change the `<link>`/`<script>` URLs in `index.html` and `fontCssUrl()` in `js/app.js`.

## Direct printing notes

- Printing works in **Chrome or Edge on desktop** only. Safari and Firefox don't support WebUSB or Web Serial, though every export still works in them.
- **Bluetooth**: pair the printer in the operating system first. On Windows it then shows up as a COM port in the browser's port picker.
- **USB on Windows**: the Brother driver claims the device, so the browser can't open it. Use Bluetooth, or switch the printer's driver to WinUSB with Zadig (Brother's own software won't see it until you switch back). On Linux, ChromeOS and macOS, USB usually works without this step.
- The raster commands follow Brother's published reference for the 128-pin, 180 dpi tape printers (PT-E550W/P750W/P710BT). The D610BT uses the same head, but **this hasn't been tested on real hardware yet**. Print the *Test label* first; if the text comes out upside down or mirrored, tick *Flip* or *Mirror*.
- If your model has no automatic cutter, use *One strip with cut marks* and cut along the dashed lines.

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
js/ptouch.js        Brother raster protocol + WebUSB / Web Serial transports
js/exporters.js     PNG, PDF, ZPL, ZIP, CSV
tests/selftest.html renders every category on every media and runs every exporter
```

## Extending

- **New library category**: add an object to `CATEGORIES` in `js/library.js` with `fields` (types `select`, `chips`, `text`, `textarea`, `check`, `icon`) and a `build(values)` that returns `{ lines: [l1, l2, l3], icon, icon2 }` rows.
- **New icon**: add an entry to `ICONS` in `js/icons.js`. Parts are SVG path strings on a 24 × 24 grid: `f` fill, `e` even-odd fill, `s` stroke, `d` dashed stroke, `w`/`wf` knock-out in the paper colour.
- **New media or sheet template**: add an entry to `MEDIA` in `js/media.js`.

After changes, open `/tests/selftest.html`; it should end with `DONE`.

Fastener dimensions are nominal values from the named standards. Check a supplier's datasheet before relying on them for engineering work.
