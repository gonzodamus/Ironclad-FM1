# IRONCLAD firmware implementation

Based on the checked-out Felucca source. Modified only `firmware/src` (no loader, USB, flash layout, project format, storage format, or engine-number change).

## New synthesis/effect behavior

- New appended per-track INSERT type 9, **METAL**: ~110 Hz low cut before gain, pick attack emphasis, asymmetric soft stage into hard clipping, two-pole cabinet-style low pass, output level, DC removal, and a quiet-tail gate. Controls are **DRIVE / CAB / LEVEL**; CAB runs dark to bright. MIX and type-change fades reuse the existing insert smoothing. Uses existing insert memory, no additional delay allocation.
- Original insert type numbers 0–8 remain unchanged. Original engine and factory preset indices remain unchanged.
- New factory-only preset fields set insert controls and distinguish retriggering MONO from legato. These fields are not written to storage: actual sound parameters use the existing project/user-preset representation.
- Loading a sound continues to preserve mixer level, sequencing, scale, chord and arpeggiator controls.

## Appended metal factory bank (zero-based engine/preset indices)

| Engine | Preset | Name | Intent |
| --- | --- | --- | --- |
| 0 ANALOG | 12 | IRON CHUG | Tight sub+saw chugs, MONO retrigger, short release, dry |
| 0 ANALOG | 13 | DOOM WALL | Sustained detuned wall, dark cabinet |
| 0 ANALOG | 14 | RAZOR LD | Hard-sync cutting lead with delay |
| 0 ANALOG | 15 | SUB HAMMR | Tight low-end foundation |
| 0 ANALOG | 16 | BLACK ICE | Slow dark PWM pad with atmosphere |
| 12 FM6 | 8 | RUST BASS | Aggressive modulator brightness + tight FM bass |
| 12 FM6 | 9 | WAR BELL | Inharmonic FM bell / industrial accent |
| 12 FM6 | 10 | CATHEDRAL | Detuned dark FM atmosphere |
| 12 FM6 | 11 | SHRED FM | Fast, bright FM lead with delay |
| 12 FM6 | 12 | MACHINE | Fast mechanical FM pluck |
| 10 DRUM | 4 | BLAST KIT | Tight kit, short decay, sharp snap, dry distortion |

SAVE > PHRASES gains appended phrases **CHUG** (14), **GALLOP** (15), **SHRED** (16), **DOOM** (17), **BLAST** (18). Numbers here are the one-based PAT references; phrase array indices are one smaller. Notes use E as the metal pedal with phrygian and diminished colors. BLAST alternates GM kick/snare; the single-lane phrase system cannot play kick/snare/hat simultaneously, but the existing DRUM grid can.

On a fresh session, parts start IRON CHUG / RUST BASS / SHRED FM / BLAST KIT at levels92/91/88/96 and160 BPM. Sequences start empty. Existing saved projects/autosave are restored through the unchanged upstream behavior, so an existing project can override fresh-session defaults.

Splash reads IRONCLAD / IC v1.0 / METAL SYNTH / Based on Felucca. About retains upstream attribution, URLs and license content. Package marker is uniquely `FM-1_990`; version is `IC v1.0` unless overridden by a release build. Upstream loader/protocol remains unchanged.

## Verification

`git diff --check` passes. Focused METAL tests pass all eight DRIVE/CAB/LEVEL corners, sample-exact MIX 0 bypass, exact fresh silence and zero tail after one second; settled DC is below 4 internal units. Signed-overflow/division sanitizer checks pass. Actual UI loads all 11 new presets with insert/retrigger values, preserves mixer level/steps, clears METAL when an original preset loads, and round-trips METAL through actual project and user-preset storage. Full host UI suite passes after explicit new startup and bank count fixture updates. DSP regression passes 109 renders with all 98 original sound hashes preserved and no health/voice/CPU failures. Hardware playback and successful installation still require physical verification. No device was flashed by this firmware agent.

## Target build runtime

An optional `JIELI_BLINK` + `JIELI_BLINK_ROOT` path was added to `tools/build.py`. It runs the official Linux x86-64 toolchain with Blink on Apple silicon, preserving the original native Linux/Docker paths. Initial startup used Ubuntu16.04 glibc2.23, but the full frontend crashes there. Ubuntu22.04 glibc2.35 compiles the full app after correcting a Blink guest-brk page-size bug. See tools/BUILDING-IRONCLAD.md and tools/blink-macos-4k.patch for the exact reproducible runner changes. The workspace build command is:

```sh
JIELI_TOOLCHAIN="$PWD/work/jieli/jieli-linux-toolchains-20260730.1" JIELI_BLINK="$PWD/work/blink/o/rel/blink/blink" JIELI_BLINK_ROOT="$PWD/work/linux-root" AC79_SDK="$PWD/work/ac79-sdk" work/venv/bin/python work/felucca/tools/build.py
```

The ELF interpreter symlink inside linux-root/lib64 must point relatively to ../lib/x86_64-linux-gnu/ld-linux-x86-64.so.2, rather than an absolute host path.
