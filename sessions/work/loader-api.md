# Firmware loader interface
`import { FirmwareLoader, validatePackage, sha256, pack7, unpack7 } from './js/loader.js'`

- `const loader = new FirmwareLoader({onStatus: event => {}})`; events `{stage, message, progress, writing, cancellable, ...details}`. Stages connect, identity, checking, loader, writing, reboot, done, error.
- `await loader.connect()` requests Web MIDI SysEx permission and returns `{inputs:[{id,name,manufacturer}],outputs:[...]}`. No firmware writes; does not automatically probe arbitrary instruments.
- `loader.listPorts()` returns same shape. `loader.onPortsChanged = ports => ...` optional callback.
- `await loader.selectPorts(inputId, outputId)` opens this explicit pair and queries identity; returns `{text,model,version,loader}`. `await loader.readIdentity()` repeats read-only query.
- `const pkg = await validatePackage(bytes, {expectedSha256, expectedProduct})` accepts ArrayBuffer/Uint8Array, validates FM-1 UFW header/list, flash/loader CRCs and entry bounds and supported loader; returns `{product,model,version,sha256,byteLength,image}`. Optional SHA pin intended for bundled artifact.
- `await loader.flash(bytes, {expectedSha256, expectedProduct})` validates before any writes, checks selected device compatibility, stages loader, serves device read requests, waits for return, checks expected identity. Can resume matching ota-FM-1. Returns `{status:'verified', identity, sha256, product}` only after new firmware reports exact package identity. Errors include `code`, `writingStarted`, `transferComplete`; a completed transfer without returned identity is NOT installation verified.
- `loader.cancel()` returns true only before an upgrade/staging command is sent; false thereafter. Never interrupt firmware writing. `loader.busy`, `loader.writing` and `loader.cancellable` expose current state.
- `loader.disconnect()` only permitted when idle; closes listeners/ports.
- Progress during checking is indeterminate (`progress:null`), writing is 0..1 based on unique served byte coverage, done is 1.
- When USB re-enumerates, auto-match only recognizable FM-1/OTA names, requiring exact model identity and a unique matching pair. Ambiguous devices fail.
- Browser must be Chromium with Web MIDI SysEx in HTTPS or localhost; modules/file fetch require HTTP serving.

- `await loader.backup()` returns the complete upstream Felucca archive object for firmware numeric identities >=900. Save as JSON using Blob/download. It sends only LIST/GET reads. Official stock firmware (<900) explicitly rejects `backupUnsupported`: stock preset preservation requires manufacturer tools. No backup success is implied for stock. It requires `./js/backup.js`, supplied alongside loader.js.

- Flash compatibility is explicit: running official FM-1_015 or Felucca/IRONCLAD numeric firmware identities >=900. Other running official versions are readable but rejected before the upgrade command. Matching ota-FM-1 recovery mode is supported. Version numbers are device identities, not semantic versions.
