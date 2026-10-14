# Source build record

This archive is not intended to be flashed. It has no stock-binary patcher. The source builds replacement firmware and does **not** read or modify M-VAVE stock firmware. Obtain and retain your own stock firmware and saved data independently; none is bundled. Optional stock-package simulation tests use your own external `STOCK_FIRMWARE` file, never a repository fixture.

## Dependencies

The single recipe below uses **Linux x86-64**. It follows the native path in `felucca/tools/build.py`; that recipe was not executed on Linux during this experiment. The completed development builds used Apple silicon, patched Blink and an Ubuntu runtime. Historical logs in `sessions/` record that route; they are not a second supported build procedure. No support or reproducibility guarantee is offered.

| Component | Version / identity | Needed for |
| --- | --- | --- |
| Linux reference userland | Ubuntu 22.04.5 LTS, x86-64 | Target-tool runtime |
| glibc | 2.35 | Target-tool runtime |
| libstdc++ / libgcc | GCC 12.3.0 runtime | Target-tool runtime |
| Python | 3.9.9, including `venv` | Build and generators |
| pip | 21.3.1 | Install pinned Python dependencies |
| Pillow | 11.3.0 | Font/icon rasterization |
| fontTools | 4.60.2 | Font and icon metadata |
| FreeType | 2.13.3 in the original Pillow build | Rasterization; bundled by the Pillow wheel |
| JieLi toolchain | jieli-linux-toolchains-20260730.1; Clang/LLVM 4.0.1, pi32v2 | Target compilation/linking |
| JieLi AC79 SDK | AC79NN_SDK_V1.2.1_2023-12-13; commit `d179b4484759423312073f5fbb232501aa491047` | SPL/config/EQ package components |
| Shell/utilities reference versions | Bash 5.1, Git 2.34.1, curl 8.7.1, GNU tar 1.34, xz 5.2.5, coreutils 8.32 | Commands below; compatible versions may work |
| Node.js | 26.5.0 | Optional JavaScript simulation tests; no npm dependencies |
| Host C compiler | GCC 12.3.0 or Clang 17.0.0 | Optional upstream host tests |
| mido / python-rtmidi / packaging | 1.3.3 / 1.5.8 / 26.3 | Physical MIDI CLI only; not used by this recipe or simulations |

Install the listed OS utilities, runtime libraries and Python interpreter before running this block. Those OS versions identify the reference environment, not a promise that current package repositories still provide them. The toolchain is downloaded separately and its exact archive digest is checked. The endpoint may change; a digest mismatch must stop the process. The SDK's three package inputs are checked by the build script.

The original font generator used BASIC Latin layout because libraqm was absent. A different Pillow/FreeType/libraqm build can change generated typography and binary hashes. This is not a bit-for-bit reproducible build claim. All samples in `felucca/assets/samples-cc0/` are licensed source assets used by the generators; they are not generated release previews. No dependency is downloaded automatically by the firmware build itself.

## One build procedure

Run from this repository's root, with Python 3.9.9 available as `python3.9`:

```sh
set -eu
python3.9 -m venv .venv
.venv/bin/python -m pip install pip==21.3.1
.venv/bin/python -m pip install -r requirements-build.txt

mkdir -p dependencies
curl -fL https://pkgman.jieliapp.com/s/linux-toolchain \
  -o dependencies/toolchain.tar.xz
printf '%s\n' 'a1545cddbc451a06bac43eb5cd96d831470c42a97c5c0b1f98879a20fc7647bd  dependencies/toolchain.tar.xz' \
  | sha256sum -c -
tar -xJf dependencies/toolchain.tar.xz -C dependencies

git clone --branch AC79NN_SDK_V1.2.1_2023-12-13 \
  https://gitee.com/Jieli-Tech/fw-AC79_AIoT_SDK.git dependencies/ac79-sdk
git -C dependencies/ac79-sdk checkout d179b4484759423312073f5fbb232501aa491047

JIELI_TOOLCHAIN="$PWD/dependencies/jieli-linux-toolchains-20260730.1" \
AC79_SDK="$PWD/dependencies/ac79-sdk" \
.venv/bin/python felucca/tools/build.py
```

Stop if any command fails. The only build entry point is `felucca/tools/build.py`. It generates local, ignored `felucca/build/felucca.bin`, `felucca/build/loader/ota.bin` and `felucca/build/felucca.fwsc`, plus temporary compiler/header files. These are not included in the archive and must not be committed or published. The historical `--release` packaging option was removed. There are no deployment commands or hosting credentials/configuration in this repository.

## Optional host checks

These commands simulate devices. They do not access physical MIDI gear. Run them from the repository root. `STOCK_FIRMWARE` must name your own unmodified official V15 file **outside** this repository. The JavaScript tests verify its known digest; no stock image is downloaded, supplied or inferred from a bundled fallback.

```sh
node --test docs/test-app-integration.mjs
STOCK_FIRMWARE=/absolute/path/outside/this/repository/your-stock-v15.fwsc \
  node --test docs/test-loader.mjs

cd felucca
AC79_SDK="$(pwd)/../dependencies/ac79-sdk" sh tests/run_tests.sh
```

The upstream host suite uses generated `felucca/build/` inputs. Its official-stock simulation explicitly skips when `STOCK_FIRMWARE` is absent. Source-generated `.bin`/`.fwsc` fixtures are simulated data, not bundled stock, and remain inside ignored build directories. Optional emulator and external-model comparisons in that inherited suite can skip when Emscripten or DaisySP are unavailable; they are outside this documented build/check procedure, and no pass is claimed for skipped checks.

The installer code is in `installer/`; upstream protocol/editor/emulator source remains under `felucca/web/`. Neither is deployed by this repository. No installation or recovery outcome is promised.
