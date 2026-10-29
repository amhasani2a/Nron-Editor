# GitHub Releases and updates

The button in Settings checks
`https://api.github.com/repos/amhasani2a/Nron-Editor/releases/latest` on demand.
There is no background telemetry or forced update. It compares stable numeric
`MAJOR.MINOR.PATCH` versions; prerelease/nightly channels are not implemented.

## Desktop: optional signed automatic install

1. Generate your publisher key locally:
   `npm run tauri -- signer generate -w <private-key-path>`.
   Keep it outside the repository. Never upload the private key in a source ZIP.
2. Repository variable **NRON_UPDATER_PUBLIC_KEY**: the public key contents.
3. Repository secrets **TAURI_SIGNING_PRIVATE_KEY** and
   **TAURI_SIGNING_PRIVATE_KEY_PASSWORD**: the private key and its password.
4. Update the version together in `package.json`, `src-tauri/Cargo.toml`,
   `src-tauri/tauri.conf.json` and `NronStudio.version`.
5. Push a matching tag, e.g. `v0.2.1`, or test the workflow manually first.
6. The workflow builds installers and `.sig` files. `tools/update-manifest.cjs`
   generates `latest.json` only for known packages with companion signatures.
7. Review and publish the **draft** release. Its stable URL becomes the update feed:
   `https://github.com/amhasani2a/Nron-Editor/releases/latest/download/latest.json`.
8. The installed client needs the **same public key** compiled in its prior build.
   Only then can it check/download/verify/install. Without a key, the shipped
   build offers release discovery and browser download; automatic install fails
   closed with a clear message.

Tauri update signatures are not Windows Authenticode or Apple notarization.
Configure those independently for production. Unsigned Windows executables may
trigger SmartScreen, and unnotarized macOS builds may be blocked by Gatekeeper.
The portable Windows test binary built on Linux is not a full Windows installer.

## Android

Android cannot silently replace an application. Use the OS installation prompt.
The package ID and signing certificate must remain the same for in-place upgrades.
Configure these repository secrets for release signing:

- `ANDROID_KEYSTORE_BASE64`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

Create and back up your own persistent keystore locally. The workflow decodes it
only to runner temp, signs the APK and removes that temporary file. No key is
created anew on each release. Without secrets, CI builds a **TEST debug APK**,
uploads it as an Action artifact and excludes it from the public release.
Do not treat test-build keys as your production signing identity.

## Checks versus guarantees
The button, version comparison, failure UI and manifest generation are tested.
A complete update through a newly published owner-signed GitHub release requires
the owner's keys and publication; this session has not published or verified that
end-to-end flow. SHA256 checksums supplied with downloads are integrity metadata,
not a substitute for trusted signing keys.
