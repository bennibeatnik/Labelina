# Labelina: project notes

Last updated: 2026-11-19

## Name and repo
- Renamed from "Partmark Label Studio" to **Labelina** on 2026-11-19.
- Repo: https://github.com/bennibeatnik/Labelina
- The auto-save key moved from `partmark-studio-v1` to `labelina-v1`; the app reads the old key once if the new one is empty. Old `.partmark.json` project files still open.

## Desktop app (added 2026-11-19)
- Why: the user found browser printing a "major drag": Chrome-only, the printer wouldn't stay connected, and USB needed Zadig.
- Decision: **Tauri 2** wrapper in `desktop/` (not Electron: about 10 MB instead of 150 MB, and the system WebView2 is already on Windows). The web version stays; `IS_NATIVE` in `js/ptouch.js` picks the transport at runtime.
- USB prints through the **Windows spooler with the RAW datatype** to the installed "Brother PT-D610BT" queue (port USB001). No status read-back on this route. **Not yet tested on hardware**: if Brother's driver turns out not to pass RAW through, the fallback is libusb plus WinUSB (Zadig again) or Bluetooth.
- Bluetooth: SPP ports are found in the registry (`HKLM\SYSTEM\CurrentControlSet\Enum\BTHENUM\{00001101…}`; instance ids ending in `&<MAC>_C…` are outgoing, all-zero MACs are incoming). Names come from `BTHPORT\Parameters\Devices\<mac>\Name`. On the user's PC: PT-D610BT1200 = COM5 (COM4 is the incoming port).
- The port is held open, and a failed write reopens it once. The last printer is remembered (`labelina-printer` in localStorage) and reconnected at startup; a manual Disconnect forgets it.
- The app's localStorage (origin `http://tauri.localhost`) is separate from the browser's, so move work across with Save project / Open.
- Fonts and libraries are now self-hosted in `vendor/` for both versions.

## Tape, HD and SLICC (added 2026-11-19)
- Source of truth: Brother "Raster Command Reference" for PT-E550W/P750W/P710BT (download.brother.com/welcome/docp100064/cv_pte550wp750wp710bt_eng_raster_102.pdf). The D610BT isn't listed, but it uses the same 128-pin, 180 dpi head.
- HD = 180 dpi across × 360 dpi along the tape, set with ESC i K bit 6; the margin is counted in 360 dpi dots (28 = 2 mm). TZe only. Implemented as layout on a square 360 grid plus 2:1 row merging (`ySub`) in `toBitmap`; `squareBitmap` repeats rows for previews and exports. **Untested on the printer.**
- Minimum feed margin is 2 mm (spec). The old UI allowed 1 mm, which would have made fixed lengths about 2 mm too long; now clamped in the layout and in the job.
- The printer feeds out at least 24.5 mm per piece; the first label of a run has about 24 mm of leader (24.3 mm "minimum margin with no precut").
- SLICC (slicc.eu) label lengths the user needs: **33 mm and 63 mm**. The presets set fixed length, 2 mm feed margin, 0 padding, 0 tape edge, cut each. SLICC label zones are 6/9/12 mm high for 2U/3U/4U cartridges (slicc.eu); the user hasn't said which tape width they use.
- HSe tubes were added from the reference's print-area table. Their width code isn't documented, so their jobs skip the width check (ESC i z flags 0x80). Untested.
- Defaults changed: tape edge 0 (was 0.2). Padding stays 1.5 mm unless a SLICC preset is chosen.
- Next: SLICC-specific designs that fit the 29 mm / 59 mm print length (the user asked to "work on designs that fit best").

## Printing stall (2026-11-19)
- The user reported the D610BT showing "Printing… please wait" and printing each label only when the *next* job arrived (so it seemed to print the previous label).
- Probable cause: Labelina sent `ESC i A 01`, which Brother's reference marks as not supported on the PT-P710BT. Removed (cut-each is the default). Also fixed n9 in ESC i z (0 first page, 1 others; it used to send 2 for the last page), and made serial writes chunked and safe against partial resends.
- **Not yet confirmed on the printer.** Over Bluetooth the app now waits for the "printing completed" status and logs the result, so a stall shows in the log. If it still stalls, suspects are HD (bit 6) on the D610BT and the USB spooler route; ask which connection was used.

## Layout engine (2026-11-19)
- The user's feedback: big gaps between icons, white space before the first icon, a huge QR with no gap, and they want more information on tall tapes and a QR size per tape.
- Icons are measured for their ink width (`iconInkBounds` in icons.js) and placed by that width. Separate `gapMm` (between groups) and `iconGapMm` (between the icons).
- Code: `codeScales[mediaId]` (size per tape), `qrQuiet` (0/1/2/4 modules), `codePos` left/right/below.
- Fixed lengths shrink icons and code (factor f) until the text has about 40% of the length, and never let them run past the label (the self-test asserts no overlap).
- Up to 5 text lines (`lineCount` setting; `lines` arrays now hold 5).

## Origin and goal
- Started as: "can I hack my Brother PT-D610BT to make perfect Gridfinity labels on the machine?"
- Decision: **no custom firmware.** There's no public work on P-touch firmware, it risks bricking the printer, and new firmware wouldn't change the hardware limits (leader tape, no half-cut). Drive the printer from outside instead.
- Goal grew into a **public, self-hosted web studio** for labelling parts and storage of all kinds: fasteners (McMaster-Carr-style options), electronics storage and drawers. Gridfinity is one preset, not the focus.
- The owner plans to host it on their own server for public use.

## Architecture decisions
- Plain static site: ES modules, no build step, no backend. Everything runs client-side; nothing is uploaded.
- Libraries from cdnjs (qrcode-generator 1.4.4, JsBarcode 3.11.6, jsPDF 2.5.1, JSZip 3.10.1); fonts from Google Fonts. For GDPR or offline use, self-host them in `vendor/` (see README).
- Layout happens in **printer dots at the media's dpi**, so barcode and QR modules land on whole dots. A layout builds a "scene" that is shared by the canvas renderer (preview, PNG, PDF), the SVG renderer and the 1-bit bitmap (printing, ZPL, .bin).
- The preview shows the thresholded 1-bit bitmap for thermal media, so it matches what prints.
- Library categories are data-driven: form `fields` + `build(values)` in `js/library.js`. Adding a category means adding an object there.
- State auto-saves to localStorage, which is tied to the URL origin (port matters). Projects also save and open as JSON.

## Printing (P-touch D610BT)
- Raster protocol taken from Brother's reference for the 128-pin, 180 dpi models (PT-E550W/P750W/P710BT). **Not yet tested on the real D610BT.**
- Orientation is unknown, so Flip and Mirror options are exposed; the user prints the Test label to calibrate.
- Auto-cutter behaviour of the D610BT is unknown. The "One strip with cut marks" output mode is the fallback.
- **WebUSB on Windows fails**: Brother's driver holds the device, so `open()` throws "Access denied". Fixed the misleading error message (it used to say the page wasn't allowed). Options: Bluetooth via Web Serial (pair in Windows → COM port), or switch to WinUSB with Zadig (breaks P-touch Editor until reverted).
- The Bluetooth path hasn't been confirmed working on the user's machine yet.
- Direct printing works only in Chromium browsers (Chrome, Edge, Brave, Opera) on desktop, over HTTPS or localhost. Design and all exports work in every browser.

## Running it
- Double-click `start-studio.cmd`, which serves on http://localhost:8000 and opens the browser.
- Or run `python -m http.server 8000` in the folder.
- Self-test: `/tests/selftest.html` should end with `DONE` (7,614 layout combinations plus every exporter).

## Status (2026-11-12)
- Built and verified in headless Chrome: parts library (22 categories), about 90 icons, 30 media profiles, codes, all exporters, light/dark themes, phone layout.
- The user liked it ("really slick") and has **more updates planned for a later session**; details not given yet.

## Open questions / next steps
- Confirm Bluetooth printing and orientation on the real D610BT; record the correct Flip/Mirror defaults.
- Collect the user's planned updates.
- Desktop app: test USB printing through the spooler and Bluetooth auto-reconnect on the real printer.
- Desktop app: GitHub Actions workflow to build installers per release; code signing (unsigned installers trigger SmartScreen).
- Before public hosting: pick a domain (GitHub Pages is the easy default).
