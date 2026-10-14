# IRONCLAD validation

Validated on the attached Mac with native Clang, using the actual Felucca/IRONCLAD C synthesis, voice, effects, editor, project, and preset sources. These are host tests; they do not establish timing or USB behavior on the physical FM-1. No firmware was written to the connected instrument during these checks.

## Results

| Check | Result |
| --- | --- |
| Upstream audio/DMA overload and voice protection | Pass |
| Upstream FM6 algorithms, envelopes, retrigger, formats and host cost | Pass |
| Flash A/B storage, torn writes, malformed records | Pass |
| User preset bank and legacy versions | Pass |
| Project formats and legacy migrations | Pass |
| Editor protocol and settings | Pass |
| Malformed editor/sample/project robustness cases | Pass |
| Command-line installer simulated transport and error cases | Pass |
| Actual package OTA staging, handshake, checksums and host loss | Pass |
| Actual loader: stock V15 → IRONCLAD, corruption rejection, protected regions | Pass |
| New METAL insert bypass, silence, bounds and DC | Pass |
| New METAL insert with signed-overflow/divide-by-zero sanitizer | Pass |
| Actual UI loader: all 11 new factory presets | Pass |
| METAL project and user-preset round trips | Pass |
| Existing preset load clears METAL; mixer level retained | Pass |
| Audio render health for all 11 new presets | Pass |
| Complete upstream UI suite | Pass, after explicitly updating startup/browsing fixtures |
| Complete upstream DSP regression | Pass: 109 renders; 0 changed/missing goldens, 0 health/routing failures, 0 existing CPU budget overruns, 0 crashes |

The new factory bank contains five ANALOG presets (indices 12–16), five FM6 presets (8–12), and BLAST KIT on DRUM (4). The focused UI test loads each through the firmware's actual `apply_preset_to` function and checks insert parameters, mono retrigger where requested, retained steps, and retained mixer level. It saves/restores the METAL insert through both the actual project path and user-preset path.

The METAL insert test covers all eight minimum/maximum combinations of DRIVE, CAB, and LEVEL with a loud 110 Hz input. The largest internal output was 73,734 units, below the internal 262,144-unit guard. The largest settled DC was 3.51 units. Every corner reached exact silence in the measured tail after one second of silent input. MIX 0 preserved every input sample exactly. Maximum settings produced exact silence from a fresh silent input. The signed-overflow/divide-by-zero sanitizer reported no failures in these checks.

All 11 new presets were also rendered for 18 seconds each, including a six-second riff and its full release/effects tail. None produced an out-of-range 16-bit output sample. All voices released, and the final quarter-second peak was at most two units. CATHEDRAL is a slow pad; a short gated riff yields a much quieter result than a held chord.

## Regression evidence

All 98 pre-existing golden audio values were preserved verbatim, including both combined-song goldens. Eleven new factory preset values were appended after checking that none of the original keys or values changed. The host preset helper now applies the appended insert/retrigger fields exactly as the real UI does, so the new regression renders exercise METAL itself.

The upstream UI suite initially exposed stale assumptions about the original startup bank and preset count. Tests now check the four exact IRONCLAD startup sounds, calculate browsing distance from the expanded bank, and explicitly choose melodic sounds for MIDI routing checks. Operator editing retains its original FM6 PAD fixture by loading it explicitly. The legacy song probes explicitly load their original sounds, preserving their existing expected hashes. The expanded bank's category table mismatch found during testing was corrected in the firmware. The complete UI suite then passed.

The final regression reports 109 golden renders, zero changed or removed goldens, zero health failures, zero voice/routing failures, zero existing CPU-budget overruns, and zero crashes. The 11 new presets have initial audio goldens; new per-preset CPU reference values have not been added. Existing CPU references were not rewritten.

## Actual installable package

The validated installable package is 610,086 bytes and identifies the app as `FM-1_990`:

```text
a7f2dacc2def888a96d8343e81c66c30843ce9a6bd9a314bc8c8b5f30da7ffa5
```

The installer tests also confirm that Python and browser JavaScript produce the same logical image and `FM-1_990` product identity from this exact package, and that its loader marker is present.

The OTA host test serves that exact package to the real firmware OTA C code with simulated NOR flash. It passes app identity, staged loader equality, loader/header/record checksums, the complete 19-request transaction, cleanup, disappearance of the host, and withheld completion confirmation. No staging write escapes `0xE0000..0xE4FFF`.

The loader test starts with the official stock V15 flash image and serves the exact IRONCLAD package. Installation completes with 2,332 protocol requests and 145 sector erases; the app area equals the package image afterward. It preserves the flash head and user-data region, rejects damaged package CRCs and foreign keys before erasing, recovers a corrupted transferred sector by rereading it, clears both update-record locations, and makes a repeat installation without erasing any sectors. The unchanged update loader identifies as `ota-FM-1_900`; the installed application identifies as `FM-1_990`.

The target build checks reported a 503,160-byte application, 55,300 / 73,728 bytes of RAM, 328,896 / 368,640 bytes in the pool, and 916 RAM-resident instructions with no calls. These checks establish target image bounds and flash-off execution constraints, not measured physical CPU performance.

## Audio previews

`audio/iron-chug.wav`, `audio/doom-wall.wav`, and `audio/shred-fm.wav` are nine-second, 44.1 kHz stereo WAVs rendered by the actual firmware DSP on the Mac. IRON CHUG and SHRED FM include drums. These are deterministic host renders, not recordings from the physical instrument. The same files are included in the webapp's `dist/audio` folder.

## Scope and limits

Functional UI tests used Inter Tight font headers generated with Pillow's BASIC shaping fallback because the available Pillow builds lacked libraqm. They establish control and storage behavior, not font kerning or visual parity. No complete target render-loop CPU budget or physical audio/MIDI/USB test is established by this report. Target compilation, image bounds, and simulated package installation passed as recorded above.

The firmware changes deliberately append the new insert and presets, retaining existing engine and stored parameter numbers. Existing sessions may sound different when the new startup bank is selected; restored projects retain their saved sounds and settings.

Focused checks are included with the source as `tests/ironclad_test.c` and `tests/ironclad_ui_test.c`, and integrated into `tests/run_tests.sh`. `tests/ironclad_render.c` reproduces the DSP audio previews. Host scratch products and raw logs remain in this task's `work/qa*` paths; generated host headers live in `work/qa-gen` and raw results in `work/qa-logs`.

To reproduce the focused checks from the source checkout after generating `build/gen`:

```sh
cc -O2 -w -Ibuild/gen -Ifirmware/src tests/ironclad_test.c -lm -o build/ironclad_test
build/ironclad_test
cc -O2 -w -Ibuild/gen -Ifirmware/src tests/ironclad_ui_test.c -lm -o build/ironclad_ui_test
build/ironclad_ui_test
cc -O2 -w -Ibuild/gen -Ifirmware/src tests/regress.c -lm -o build/ironclad_regress
build/ironclad_regress tests/golden.txt tests/cpu_baseline.txt
```

## Web loader

The custom browser loader and app integration suites pass 32 tests covering bit packing, CRC/SHA validation, explicit port selection, two-stage device-pull updates, OTA resume, cancellation lockout, invalid ranges, timeouts, USB disconnects, exact post-reboot identity, stock backup rejection, stale asynchronous file reads and changing MIDI ports. These use simulated MIDI devices.

The actual 610,086-byte custom firmware passed the browser loader's validation against the release SHA-256 and `FM-1_990` identity. In the local browser preview, the bundled release reports a matching SHA-256; selecting the official recovery file reports `FM-1_015`, 699,956 bytes and valid CRC/SHA checks. Installation remains disabled until a device is identified and preparation is acknowledged. Browser checks performed no firmware writes. The connected physical device was independently read via CoreMIDI and reported stock `FM-1_015`.


## Loader connection fix

Connect now automatically identifies a unique FM-1 input/output pair; explicit port selection automatically verifies the chosen pair. Install displays the exact remaining requirements instead of staying silently disabled. A MIDI permission request that does not resolve returns a desktop Chrome/Edge instruction after 15 seconds. The 32-test web suite covers the reported connect → firmware selection → preparation checkbox flow and confirms that unknown devices, missing preparation and failed identity checks keep Install disabled. No firmware changes were made for this fix.
