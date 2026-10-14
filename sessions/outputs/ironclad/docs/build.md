# IRONCLAD 1.1 build provenance

The final package was compiled from the modified firmware source with the official target compiler. No physical installation or listening test was performed by this task.

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| IRONCLAD package | 610039 | `af94b49527d2230e2226090a30c9bdffa48da9b0640b15e20404cdc6a77c9be1` |
| pi32v2 app | 505024 | `bd0f63e30947f607b7337fc963c46ee42d4ec6d2e1c42725fb1ba7e4aa1bfcca` |
| RAM update loader | 6883 | `215c40c7bb4e7d740f9254a121750b7fe8413e579d55d60878524c0ab496e1d4` |

Package identity is **FM-1_991**, display version **IC v1.1**. The internal update protocol retains its compatible `ota-FM-1_900` identity and loader marker. USB names are IRONCLAD and IRONCLAD Update.

## Inputs and compilation

The firmware base is [hugelton/Felucca](https://github.com/hugelton/Felucca), commit `1727537624390cc3f9c7dff2456b43b3a8edb005`. Initial reverse-engineering research came from [aroum/fm1-custom-fw](https://github.com/aroum/fm1-custom-fw). Required attribution and licenses are retained.

The official JieLi toolchain is `jieli-linux-toolchains-20260730.1`, Clang/LLVM 4.0.1 targeting pi32v2. Its archive SHA-256 is `a1545cddbc451a06bac43eb5cd96d831470c42a97c5c0b1f98879a20fc7647bd`. AC79NN SDK 1.2.1 package components match the source's required hashes; Apache notices accompany them.

This is a clean build: all release headers were regenerated, the full current application source was compiled, and the loader was freshly compiled. No previous application IR or loader object was reused. See [build.log](build.log) for the final successful output and source `tools/BUILDING-IRONCLAD.md` for the command.

On this Apple-silicon Mac the Linux x86-64 compiler ran through Blink commit `f006a4fc6f9b8de9272504fdff0dbbe5ce5dc580` with an isolated Ubuntu 22.04 runtime. The included `blink-macos-4k.patch` corrects guest heap alignment to 4096 bytes and expands the guest stack to 64 MiB. The Clang driver loses its executable path under this runner; `tools/build.py` extracts its exact `-###` stages and invokes cc1/cc1as with the actual resource directory. These are host build corrections; the official target tools link and package the firmware.

## Bounds and validation

The target app is **505024 bytes**. RAM `.data + .bss` is **55300 / 73728 bytes**; the fixed pool is **328896 / 368640 bytes**. Interrupt RAM code has **916 instructions and no calls into flash**. Register access remains confined to the HAL. All upstream build checks pass.

See [validation.md](validation.md) for native display, sound, persistence, loader and actual-package simulation results. Host simulation does not establish physical FM-1 timing or reliability.

## Exact generated inputs

[generated-headers.tar.gz](../source/generated-headers.tar.gz) contains the exact release headers. Fonts use bundled Inter Tight outlines with the explicit BASIC Latin fallback because libraqm is unavailable. UI rendering and alignment tests passed using these same assets. The horned skull and angular wordmark are original code-native drawings.

| Header | SHA-256 |
| --- | --- |
| `felucca_fm6.h` | `10699add2197642d94c6559d2e8ee1fa1d1358421c0b03a647569100b209d93b` |
| `felucca_samples.h` | `d72405f100494dce4c3bff53de584423b0ab96cf9b196a85487b13206ae032bc` |
| `felucca_tables.h` | `a975289289c52b9f9fd2ff985a147b199f8a3afa9fb416e95f99cb83131993cb` |
| `ui_fonts.h` | `7fc3939dfff080497a1e2c68692714fedfd8fbdf90574eb44370176d6aeb74a9` |
| `ui_icons.h` | `85947fe4a0307f806613870ad117c1fe4d4c7256786843ea88d14d104c7687aa` |
| `ui_keycaps.h` | `a19caf335395a36ebda8801ec4127d54ec1974647b84e27e243716602a988d4d` |
| `ui_palettes.h` | `d46ceac578644ac936b672c5c374f86663c82ba083e45d35bd50067d7d8b5550` |
