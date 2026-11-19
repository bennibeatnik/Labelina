# OPEN ISSUE (top priority): the PT-D610BT doesn't finish Labelina's print jobs

Status: **unresolved** as of 2026-11-19 (end of a full day on it). Fix this first in the next session.
The owner is frustrated: a day and about $100 of usage went into printing fixes without a working print.

## Symptom (latest build, commit f3da428)
Printing over **USB** from the desktop app ("Brother PT-D610BT · USB", direct usbprint route):
1. The printer feeds blank tape and cuts it (the pre-cut, same as Brother's own software). ✔
2. It prints the label. ✔
3. It does **not** feed and cut at the end. The display stays on **"Printing… please wait"**. ✘
4. Earlier builds showed the related symptom that a label only came out when the *next* job was sent ("it prints the previous label"). Both point to the printer never seeing the end of the job.

Recover the printer by switching it off and on. P-touch Editor (Brother's driver) prints fine on the same machine, so the printer and tape are OK.
Tape loaded: 12 mm TZe **Flexible ID** (status media type 0x14). Windows: Brother driver installed, queue "Brother PT-D610BT" on USB001, VID_04F9 PID_20E1.

## What has been tried (none fixed it)
| Change | Result |
|---|---|
| Removed `ESC i A` (unsupported on PT-P710BT family) | still stuck |
| Windows print queue (RAW) route | jobs hung in the queue ("Printing, Retained", 0 bytes); old labels came out on replug. Route removed. |
| Direct USB via usbprint (`\\?\USB#VID_04F9&PID_20E1#…#{28d78fad-…}`), two-way status works | printer receives jobs; same stuck end |
| Copied Brother driver's command set: `ESC i !` 01, `ESC i p/L/C`, uncompressed raster, HD as 0x86/0x09 | pre-cut started working; still no final cut |
| Fixed orientation (top row → first print-area pin) | correct now |
| Stopped polling `ESC i S` after a job | still stuck |
| **Byte-identical to Brother's driver output** (removed `ESC @`, end with `FF` not `1A`, added `ESC i U` with job counter) | **still stuck** |

`node tests/brother-match.mjs` proves the job bytes equal the driver's "print to file" output for 12 mm, 12 mm HD and 24 mm.

## So the difference is *not* in the job bytes the driver generates
What Brother's path does that Labelina doesn't:
1. **Brother's language/port monitor** sits between the driver and USB. "Print to file" skips it, so anything it adds or does is invisible in our captures: the 74-byte "J…BSP21Ar.dll" header is meant for it, it may send extra bytes at the end of the document, read status, or close the port.
2. **Opening and closing the port per job.** The spooler opens the USB port for a job and closes it at the end. Labelina keeps the usbprint handle **open** between jobs (`desktop/src-tauri/src/printer.rs`, `Link::UsbDirect`).
3. **Reading the printer's replies.** The reference's USB flow (section 5.1) has the host reading status; Labelina now writes the job and reads nothing.

## Next steps, in order (cheapest and most informative first)
1. **Capture what actually goes over USB when P-touch Editor/Brother's driver prints one label** (USBPcap + Wireshark, one label of tape; ask the owner first). Compare with Labelina's bytes; this settles it instead of guessing.
2. Quick experiments, one label each (ask before printing):
   - close and reopen the usbprint handle after every job (match the spooler's open/close);
   - after the job, read the printer's IN pipe until it goes quiet (drain status replies) instead of staying silent;
   - send the job through the Windows queue again but with Brother's 74-byte header in front (so Brother's monitor treats it as its own).
3. If none of that works: print through Brother's official **b-PAC SDK** (what P-touch-style apps use), or through the driver with a custom paper size created in the driver's Printing Preferences and selected by name.

## Ground rules for this
- Don't claim a print fix works without the owner confirming a printed, cut label. Say "untested on the printer".
- Ask before anything that uses tape or touches the Windows print queue (captures to file still trigger Brother's status monitor pop-ups).
- When the driver and the manual disagree, follow the driver.
- Evidence files: `tests/brother-driver/*.prn` (driver captures), `docs/project-notes.md` (full history), decoder scripts were in the session scratchpad (raster2img.mjs logic is reproduced in `tests/brother-match.mjs`).
