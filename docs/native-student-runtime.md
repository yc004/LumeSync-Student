# Native Student Runtime

This repository now contains a native Windows student runtime alongside the legacy Electron implementation.

## Architecture

- `LumeSyncStudentShell.exe` is the foreground Win32/WebView2 host. It loads the teacher URL, injects the `studentHost` bridge, hosts the local TypeScript admin/offline pages, and enforces classroom window policy.
- `LumeSyncStudentGuardSvc.exe` is a Windows service. It runs per-machine, reads `%ProgramData%\LumeSync Student\config.json`, and launches the foreground shell into the active user session when `autoStart` and `guardEnabled` are enabled.
- `ui/student-host` contains the TypeScript admin/offline pages. The checked-in `dist` files are usable by the native shell immediately; run `npm run build:host-ui` after editing the TS sources.
- `shared/protocol/student-host.ts` defines the browser-facing host API used by local pages and remote teacher pages.

## Build

```powershell
npm install
npm run build:host-ui
npm run build:native:configure
npm run build:native
npm run package:student-native
npm run package:student-native-installer
```

The native build requires a Windows C++ toolchain and the WebView2 SDK headers. If WebView2 headers are not present, the shell still configures with a fallback window, but it will not render classroom content. At runtime, `WebView2Loader.dll` must be deployed next to `LumeSyncStudentShell.exe` or be available through the process DLL search path.

## Runtime Files

- Config: `%ProgramData%\LumeSync Student\config.json`
- State: `%ProgramData%\LumeSync Student\state.json`
- Logs: `%ProgramData%\LumeSync Student\logs\shell.log` and `service.log`
- Local pages: `ui/student-host/dist/admin.html` and `offline.html`
- Native package staging: `dist/student-native`
- Native installer: `dist/installer/LumeSync Student Native Setup 1.0.0.exe`

## Deployment

Run the generated installer as an administrator on each student PC:

```powershell
dist\installer\LumeSync Student Native Setup 1.0.0.exe
```

The installer copies the native shell, guard service, WebView2 loader, and local UI assets to `Program Files`, registers `LumeSyncStudentGuard` as an automatic Windows service, creates Start Menu shortcuts, and adds an uninstall entry.

The guard service is configured for managed-device hardening:

- Service Control Manager restarts it after unexpected termination.
- Restart delays are `1s`, `3s`, and `5s`, with a one-day failure reset window.
- Failure actions are enabled for non-crash termination cases.
- The service is marked as delayed automatic start.
- Authenticated users can query the service, but only LocalSystem and Administrators can stop or reconfigure it through Service Control Manager.

This does not make the service unkillable to a local administrator. For student devices, deploy students as standard users and use Windows policy to block Task Manager or deny elevation.

## Security Boundary

The native runtime raises the escape cost for normal student accounts by combining a foreground shell, full-screen/topmost behavior, focus recovery, common shortcut suppression, and service restart. It does not block Windows secure attention paths such as `Ctrl+Alt+Del`, administrator process termination, or security desktop transitions. Those require managed-device policy, kiosk/assigned access, or deeper OS controls.
