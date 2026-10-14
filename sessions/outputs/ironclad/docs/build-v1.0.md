# IRONCLAD build provenance

The installable package was built successfully from the modified firmware source. No synthesizer was flashed during this build.

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| IRONCLAD firmware package (`felucca.fwsc`) | 610086 | `a7f2dacc2def888a96d8343e81c66c30843ce9a6bd9a314bc8c8b5f30da7ffa5` |
| Native pi32v2 app (`felucca.bin`) | 503160 | `84a15077a97ee5dd98887baba79ef3537d9ebaee29a714273bbb244dbed37328` |
| RAM update loader (`ota.bin`) | 6930 | `a48ee499520cb16750e2504264bd8a8cd3e13ea953bbf319537cb840eb0d2115` |

Package/app identity is **FM-1_990**, version **IC v1.0**. The existing upstream update loader retains its **ota-FM-1_900** identity; the update protocol discovers loaders by their `ota-` prefix. Its USB, flash boundaries and recovery behavior are retained.

The full successful build output is [build.log](build.log).

## Source and toolchain

- Firmware base: [hugelton/Felucca](https://github.com/hugelton/Felucca), commit `1727537624390cc3f9c7dff2456b43b3a8edb005`.
- Starting research repository: [aroum/fm1-custom-fw](https://github.com/aroum/fm1-custom-fw).
- Official JieLi toolchain: `jieli-linux-toolchains-20260730.1`, Clang/LLVM 4.0.1, target **pi32v2**, downloaded through [JieLi's toolchain endpoint](https://pkgman.jieliapp.com/s/linux-toolchain).
- Toolchain archive SHA-256: `a1545cddbc451a06bac43eb5cd96d831470c42a97c5c0b1f98879a20fc7647bd`.
- SDK package components match upstream's expected AC79NN SDK 1.2.1 hashes: `uboot.boot`, `cfg_tool.bin`, and `cfg/eq_cfg_hw.bin`. Their Apache license texts accompany the firmware source/package distribution.
- Host: Apple silicon macOS. Linux x86-64 tools ran using [Blink](https://github.com/jart/blink), commit `f006a4fc6f9b8de9272504fdff0dbbe5ce5dc580` with the [included runner patch](../source/blink-macos-4k.patch).

## Runner corrections

Blink's memory-safe mode advertises 4096-byte guest pages but its original `brk` handler rounded the heap to Apple's 16384-byte host pages. This corrupted glibc allocations. The included patch makes that handler use guest pages in memory-safe mode and increases its guest stack to 64 MiB. These corrections affect the build runner only.

The full app frontend succeeded with the Ubuntu 22.04 x86-64 runtime after the heap correction. The older Ubuntu 16.04 runtime could compile the small loader but failed on both the unmodified upstream full source and the modified full source. The final loader object came from the successful optimized old-runtime compilation; the full app came from the successful modern-runtime frontend and JIT-enabled backend.

The old Clang driver also loses its own executable path under the modern runtime. `tools/build.py` now asks the driver for exact `-###` frontend stages, invokes those directly, and supplies the actual Clang resource directory. Assembly preprocessing and assembly are run in their required order. The final native object, ELF, flash image and installable package were linked and packaged by the official target tools and upstream package code.

The final build reused the successful generated headers, valid frontend IR and unchanged compiled loader object to avoid repeating expensive compilation while fixing the runner. For a clean rebuild, the normal `tools/build.py` command in `tools/BUILDING-IRONCLAD.md` regenerates and compiles all inputs using the corrected runner path.

## Generated headers

The exact headers used for the compiled package are preserved in [generated-headers.tar.gz](../source/generated-headers.tar.gz).

Synthesis tables, FM6 patches, samples, icons, keycaps and palettes came from the repository's generators and bundled source assets. `ui_fonts.h` uses the bundled Inter Tight font with a BASIC Latin layout fallback because optional libraqm was unavailable. The fallback omitted OpenType kerning and stripped unsupported feature arguments; it retained the font outlines and attribution. This changes spacing metrics. The source generator now includes the equivalent explicit fallback, and the full functional UI tests passed with those headers. No claim is made of hardware visual inspection.

| Header | SHA-256 |
| --- | --- |
| `felucca_fm6.h` | `d1859b8194443ecbe099505909d6ea4db866d919100c81d738bb06d56004f791` |
| `felucca_samples.h` | `d72405f100494dce4c3bff53de584423b0ab96cf9b196a85487b13206ae032bc` |
| `felucca_tables.h` | `a975289289c52b9f9fd2ff985a147b199f8a3afa9fb416e95f99cb83131993cb` |
| `ui_fonts.h` | `112844d30e28fad9dd9ea5a1c35fb9c78dd1501c015201f5d96b293fe3c823ea` |
| `ui_icons.h` | `85947fe4a0307f806613870ad117c1fe4d4c7256786843ea88d14d104c7687aa` |
| `ui_keycaps.h` | `a19caf335395a36ebda8801ec4127d54ec1974647b84e27e243716602a988d4d` |
| `ui_palettes.h` | `e87e29243c6129e8bd238cae5b185ca0357483f6a1787f78f63ecf54ce8dad05` |

## Verification

- Native target image size: **503160 bytes**; accepted by upstream package/build checks.
- RAM `.data + .bss`: **55300 / 73728 bytes**.
- Pool: **328896 / 368640 bytes**.
- RAM code: **916 instructions**, no calls into flash.
- Hardware register access remains inside the HAL.
- Host DSP regression: **109 renders**, with all **98 original hashes preserved**, no sound health, voice/routing or host CPU budget failures.
- Complete functional UI tests pass after updating explicit new-startup and bank-count fixtures.
- Focused METAL tests pass silence, exact bypass, parameter corners, tail decay, DC bounds and signed-overflow/division checks.
- Actual UI loading and real project/user-preset round trips preserve the new effect parameters and existing mixer/sequence behavior.
- Actual package OTA staging passes 19 protocol requests, including host loss and withheld confirmation.
- Actual package loader simulation upgrades from official stock V15 in 2332 requests and 145 sector erases, preserving protected head/user data and passing CRC/foreign-key rejection, corrupted-sector reread, and idempotent reinstall checks.

Hardware audio, timing and installation have not been validated on the connected FM-1. The connected device was left unflashed.
