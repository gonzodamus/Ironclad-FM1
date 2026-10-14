# IRONCLAD 1.1 firmware visual revision

Implemented in the real 240×240 firmware renderer:

- Original horned iron skull/blade sigil and large angular IRONCLAD wordmark, generated directly in C without external art assets.
- Bone, iron, and ember default theme, clipped steel corners throughout cards, menu selections, graph panels, and key cushions; subtle header/footer rails and active-knob edge accents.
- Full-screen splash drawn with two 240×120 strips (existing canvas memory budget), with `FM-1 // WAR MACHINE`, `METAL SYNTHESIS`, the current build version, and `FORGED FOR THE RIFF`.
- Splash remains visible for 1.2 seconds; watchdog feeds every 10 ms while master polling and the existing interrupt-driven audio/MIDI scanning continue.
- IRONCLAD About screen and fault title; removed upstream splash tagline and promotional website QR. Upstream authorship and licence information remain in the scrollable legal credits; the source download points to the IRONCLAD release site. No Felucca brand text remains in normal on-device UI.
- Eleven built-in themes, all dark; legacy bright PAPER is now bone-on-iron. Every palette passes the existing 21 contrast-pair checks, including values, labels, selections, keys, and hot controls.

Persistence:

- New palette tag 128 distinguishes new settings from old untagged0–19 and tagged64–73 palettes. Legacy themes migrate once to IRONCLAD (index10), then subsequent explicit built-in choices persist normally under128–138. User custom palettes and musical project data are retained.
- Index slots0–9 are preserved. IRONCLAD is appended as10. This avoids moving old palette identities in the editor/backup schema.

Files changed by UI agent: `firmware/src/gfx.c`, `ui_draw.c`, `ui_menu.c`, `panel.c`, the splash/fault lines in `main.c`, and `tools/gen_ui_palettes.py`. Generated headers refreshed in `build/gen` and `work/qa-gen`.

QA agent owns regression fixtures and screenshot rendering. No device flash performed by UI agent. Main target build and final release package are owned by parent.

Final QA repair: partial BPM and metronome header repaints redraw the exact same rail as a full repaint, preserving pixel coherence during rolling tempo updates.
