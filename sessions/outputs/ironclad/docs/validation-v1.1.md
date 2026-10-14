# IRONCLAD 1.1 validation

These checks use the actual C firmware drawing, synthesis, preset-loading, and storage code on the attached Mac. No firmware was flashed and no physical FM-1 audio, timing, or USB behavior is established by these host checks.

## Display

The actual drawing code and generated release assets (the build uses BASIC Latin font layout because libraqm is unavailable) render the 240 × 240 screenshots in `visuals/`: `splash.png`, `home.png`, `metal-insert.png`, `fm6.png`, and `drums.png`. `contact-sheet.png` presents those five screens together. The splash has an original horned skull, angular IRONCLAD wordmark, and the version; it uses two 120-row canvases within the existing display memory budget.

The complete native UI layout suite passed 233 screen scenarios across all 11 palettes, including FLAT/LINE and LARGE styles, 195,080 column values, and 670 FM6 algorithm charts. It found zero out-of-bounds, clipping, text overlaps, unreadable foreground/background pairs, non-neutral GREY/MONO pixels, or alignment errors of at least one pixel in 3,155,795 measurements. Free text that intentionally ellipsizes remains allowed; labels and values must fit. The five-screen gallery separately reports zero layout findings.

The theme test passes the original contrast requirements for every palette, including the new bone/ember/black IRONCLAD palette. Legacy stored palette IDs migrate once to IRONCLAD through a new persistence tag. Subsequent explicit palette selections round trip normally; the settings test covers all 11 current IDs and all legacy IDs. The complete upstream functional UI suite passes. A display artifact found during review was fixed: partial BPM/metronome redraws now retain the engraved bottom rail, including under unchanged rolling digits. Pixel geometry fixtures explicitly exclude the decorative rail while retaining the original position/alignment assertions, and the active-card fixture uses its actual card bounds. The upstream donation QR has been removed from About; the replacement document preserves its fixed footer and scrolling behavior. Attribution remains in source and licensing documents.

## Sound and data

All 98 pre-existing golden audio renders remain byte-for-byte unchanged. Only the 11 appended IRONCLAD factory preset golden values were updated intentionally. The complete regression passes 109 renders with zero changed or missing goldens, audio-health failures, voice/routing failures, existing CPU-budget overruns, or crashes. CPU measurements here are host instruction counts, not physical FM-1 performance measurements. Existing CPU reference values were not rewritten.

Every new preset was separately rendered for 18 seconds with a fixed riff and full release tail. None produced a sample beyond 16-bit output range; every voice released, and the final quarter-second peak was at most two sample units. The slow CATHEDRAL pad remains intentionally quiet with this short gated riff; held chords better represent it.

The METAL insert passes exact MIX-zero bypass, fresh-silence, and all eight minimum/maximum DRIVE/CAB/LEVEL combinations. The largest internal output was 80,013 units, below the 262,144-unit guard, the largest settled DC offset was 4.28 units, and all measured tails reached zero. Signed-integer-overflow and divide-by-zero sanitizer checks pass.

Focused preset integration tests pass all 11 new factory loads, unchanged steps and mixer level, insert parameters, mono retrigger where requested, METAL project/user-preset persistence, and removal of METAL when loading an original preset. For each of the five dedicated FM6 voices, additional tests alter the algorithm and an operator level, then verify the exact 155-byte edited voice and all seven macros survive both project and user-preset restoration. Selecting legacy SLOT F1 loads its original voice; returning to OWN restores the edited IRONCLAD voice. The eight original FM6 factory slot numbers retain their meanings.

Audio/DMA overload, flash storage, legacy user presets and projects, editor protocol, malformed-data robustness, backup/restore, FM6 algorithms/formats, USB descriptors, and USB audio stream/resampler host checks pass. The USB descriptor test additionally checks the exact IRONCLAD manufacturer/product UTF-16 strings and their descriptor lengths.

## Audio previews

`audio/iron-chug.wav`, `audio/doom-wall.wav`, and `audio/shred-fm.wav` are nine-second, 44.1 kHz stereo WAVs rendered by the actual firmware DSP. IRON CHUG and SHRED FM include the revised BLAST KIT. The corresponding 18-second raw renders had peaks 18,264, 12,310, and 18,446, respectively; all tails settled and voices released.

A controlled drum-free comparison is available as `audio/<name>-v1.0-level-matched.wav` and `audio/<name>-v1.1-level-matched.wav` for the same three sounds. Both revisions play identical notes and timing. Each file is matched to an RMS of 2,400 sample units over the six-second sounding region (approximately -22.7 dBFS), with no clipping. Version 1.0 was captured using a native executable compiled before any sound edits. These previews compare tone and dynamics without a simple loudness advantage; they are host renders, not instrument recordings.

## Package checks

The final package was rebuilt from the final sources and generated headers after the partial-header redraw fix; it identifies as `FM-1_991` and is 610,039 bytes. Its SHA-256 is:

```text
af94b49527d2230e2226090a30c9bdffa48da9b0640b15e20404cdc6a77c9be1
```

The real firmware OTA C code accepts this exact package through a simulated 19-request transaction: identity, loader staging and equality, loader/header/record checksums, commit, cleanup, lost host, and withheld completion confirmation all pass. No staging write escapes `0xE0000..0xE4FFF`.

The real loader C code installs this exact package over the official stock V15 image in simulated NOR: 2,332 requests and 145 sector erases. The app area matches the package afterward, the flash head and user-data region are preserved, both update records are cleared, a corrupted transfer is reread, damaged/foreign packages are rejected before erasing, and repeating the installation erases nothing. These are simulations; no firmware was written to the physical instrument.

The fresh target build passes image bounds and flash-off execution checks:

| Target build check | Result |
| --- | --- |
| Application image | 505,024 bytes |
| RAM `.data + .bss` | 55,300 / 73,728 bytes |
| Pool | 328,896 / 368,640 bytes |
| RAM-resident instructions | 916; no calls |
| Direct register accesses | HAL only; application/loader clean |
| Configured static render-loop budgets | Pass, existing tolerance; reference values unchanged |

Static target budgets are instruction estimates from the actual pi32v2 disassembly. They do not establish physical DSP timing, update reliability, USB behavior, or acoustic performance. Raw final logs are `work/qa-v11/ota-package-final.log`, `loader-package-final.log`, `target-budget-final.log`, and `work/target-build-v11-final.log`.
