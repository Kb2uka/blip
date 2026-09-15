# Development log

## 2026-09-07 — Upstream composer update

- Updated the installed plugin to upstream ba1d8f9 (manifest 2.3.3), including the fix that keeps the cursor visible after a draft exceeds the composer height.
- Updated the Mac imsg tool to the matching upstream version and restarted the shell.
- Earlier local merged-conversation changes are included upstream; preserved the installed diff in a Git stash before updating. No additional application patch was needed.
- Verification: 391 TypeScript tests and 48 Mac-tool Python tests passed; synthetic drafts wrapped to 18 lines in the wide view and 26 in the narrow view, scrolled to the cursor, and shrank to one line when cleared. Inspected the synthetic narrow-view screenshot. Installed tests passed again; runtime reported online, healthy, and push enabled; Mac tool checksum matched.
- No real messages were read or sent during testing. Visual confirmation in the user's normal session remains with the user.

## 2026-09-07 — Restore the app on its last workspace

- Remember the window's actual workspace, including moves while unfocused. Restore an open window there without initial focus; leave closed windows closed. Explicit launches remain available.
- Prepare placement before mapping through a narrowly matched, unique restoration title and one replaceable runtime compositor rule. No permanent workspace rule or user configuration is required by the application. A missing old workspace field falls back to quiet placement on the current workspace. A failed preparation leaves automatic restoration closed.
- Wait for compositor metadata before identifying the shell's own window; never match another process by title alone. Persist no conversation data.
- Verification: 394 tests passed. An isolated window restored on workspace 4, followed a manual move to 5 on its next restart without changing the active workspace, and stayed closed after closing and restarting.
- Removed the earlier fixed-workspace workaround. The existing window had already recorded workspace 2 during deployment. A live shell restart from workspace 3 restored Blip on workspace 2, unfocused, with healthy IPC; all 394 installed tests passed. This patch is local pending upstream submission.
