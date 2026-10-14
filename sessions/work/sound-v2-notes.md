# IRONCLAD sound revision 1.1

Baseline protected in `work/sound-v2-before/` and QA renders in `work/qa-v11/baseline/`. No device flash performed.

## Scope and compatibility

- Exactly the same 109 factory presets: the original 98 untouched; the existing 11 IRONCLAD additions revised. All names and preset indices kept.
- Original 8 FM6 factory packed voices and INIT byte-for-byte preserved. Five authored metal operator voices live in a separate 640 byte flash table. They load through the existing 155 byte OWN voice path, preserving SLOT IDs, bank IDs, and all project/user-preset formats.
- No new audio state memory: METAL reuses inactive PHASR history cells. All synthesis remains fixed-point. No output gain increase requested or added globally.

## Intentional changes and preview indices (zero based)

| Engine/index | Preset | Revision |
| --- | --- | --- |
| ANALOG 0 /12 | IRON CHUG | Less sub-oscillator masking, sharper filter-envelope attack, stronger sustained note body, shorter damped release, less redundant pre-drive; retrigger remains tight. |
| ANALOG 0 /13 | DOOM WALL | Tighter detuning, less cascading saturation, darker fundamental with more opening filter movement, long heavy sustain retained. |
| ANALOG 0 /14 | RAZOR LD | More sync bite, less resonance/pre-drive, faster articulation, shorter release and less wash. |
| ANALOG 0 /15 | SUB HAMMR | More fundamental sustain and definition, reduced square sub share and saturation, fast release retained. |
| ANALOG 0 /16 | BLACK ICE | Faster ominous pad attack, a little more filtered air and movement, less detune/effect smear, dark cabinet. |
| FM6 12 /8 | RUST BASS | Dedicated three-pair voice: defined 1:1 growl, quieter half-frequency body, brief ratio 7 pick transient, fast operator releases and velocity-responsive modulators. |
| FM6 12 /9 | WAR BELL | Dedicated paired inharmonic 3.5/7.13/11 ratio strike, a pitched fundamental underneath, shaped clang decay, shorter effects. |
| FM6 12 /10 | CATHEDRAL | Dedicated slow three-pair drone: octave-down foundation, evolving harmonic 1/3/7 modulation, delayed subtle vibrato, restrained spatial tail. |
| FM6 12 /11 | SHRED FM | Dedicated fast-attack lead replacing brass overlay: 1:1 snarling body, ratio 3 octave edge, brief ratio 7 pick transient, delayed vibrato, velocity-sensitive brightness, less effects wash. |
| FM6 12 /12 | MACHINE | Dedicated percussive three-pair riff voice with 2/5/11 ratios, rapid decaying operator envelopes, no reverb, retriggered mono. |
| DRUM 10 /4 | BLAST KIT | Lowered tuning toward fundamental, less extreme snap and redundant saturation, slightly longer shell body to make rapid kicks/snare defined instead of papery. |

## METAL insert

- Pre-cut shifts from 110 Hz to 55 Hz, retaining low bass/guitar roots while removing sub-rumble. Existing ~880 Hz pick emphasis stays.
- Adds broad, bounded speaker-presence emphasis from stable one-pole differences, followed by the two-pole cabinet filter. Dark cabinet keeps more useful midrange than v1.0.
- Quiet-tail envelope release is smoother and the Q16 gate gain now has separate fast opening/slow closing to avoid threshold chatter. Exact fresh silence, bypass, DC control, headroom and tail limits validated at all 8 DRIVE/CAB/LEVEL corners.
- Memory size unchanged; target runtime budget pending parent/QA target build.

## Validation

Original 8 FM6 factory patches/INIT compared equal. Dedicated voices each valid 128 byte packed records. Focused METAL test: all 8 corners pass, worst measured internal peak 80013 (<262144), worst DC 4.28 units, final tail 0. Further whole-firmware regression, audio health and target checks owned by QA/parent.
