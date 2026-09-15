# Extension-free OTP autofill

This local enhancement is bundled into Blip and merged with upstream `main`
at Blip 2.5.0 (`abde42dd1b00419598c2d1e8edc11be1cac53aba`). It consumes upstream's
existing OTP events without changing the collector. It adds an OS field adapter
and a native Omarchy prompt; no separate plugin or browser extension is required.
When enabled, the new private helper owns the pending code. Upstream's legacy
code toast/copy/type path remains available when this option is off.

## What it does

Blip recognizes new incoming verification messages from SMS and iMessage. The
Mac must receive SMS through iPhone Text Message Forwarding. Each new code is
available for five minutes from Blip's receipt. Changing focus preserves the
pending code and its original deadline. Filling, dismissing, replacing it with a
new code, disabling the feature, or exiting the helper clears that pending code.

The prompt and Blip's conversation view share `BlipAppearance.qml`: font selection,
`ui_font` / `ui_font_size`, palette and blue accent policy. Omarchy's native
controls supply their themed states. Appearance changes belong in this shared
component so both surfaces inherit them. The speech icon identifies Blip.

When AT-SPI supplies usable field bounds, the prompt appears just below the
field, or above it if there is insufficient room. Its position is clamped to the
screen and follows field movement. When bounds are unavailable it uses the top
right of the active monitor. It does not request keyboard focus. Click **Fill code** to insert; **×** dismisses the code
across subsequent focus changes. It sends no Enter key and submits no form.

- **Smart:** an empty, single-line input has a verification label or OTP metadata.
  A site need not declare `autocomplete="one-time-code"`.
- **Excluded when known:** chat composers, multiline/contenteditable editors,
  password, email, phone, search, address-bar and unrelated labeled controls.
- **Manual:** a browser exposes an ambiguous input or no usable field metadata.
  Select the intended field, then click. Without metadata the helper cannot
  distinguish a webpage field from a chat editor or address bar.
- **Domain-bound messages:** an `@example.test #…` code requires the exact HTTPS
  document hostname. Missing origin information hides this kind of code instead
  of offering manual insertion on an unverified site.

## Native OS approach

`collector.ts → OtpAutofill.qml → otp-autofill.ts ↔ otp-desktop.py`

The collector reuses the existing new-message watermark and opaque deduplication
ring. The leader Blip widget alone starts the helper. Internal inherited pipes
carry bounded JSON events: `code`, `focus`, `offer`, `accept`, `dismiss`, and `hide`.
There is no public OTP socket, native-messaging host, or secret-bearing shell IPC.

The Python adapter listens to **AT-SPI**, Linux's application accessibility API.
It reads focused-control attributes, its empty/nonempty state, and its document's
origin. It does not read input values or entire page text. **Hyprland** supplies
the active window identity and monitor. The adapter verifies the accessibility
application PID against that window. Session locking suppresses offers and fills.

On a click, metadata and focus are checked again. Native widgets offering
`EditableText` can receive text directly. Chromium does not expose that interface
for its web inputs in the tested build, so Blip sends individual key down/up
pairs directly to Hyprland's socket, targeting the original window. No clipboard,
DevTools connection, virtual keyboard daemon, code in process arguments, or
Enter key is involved. A focus/window change aborts insertion.

## Browser coverage and activation

| Browser/application | OS interface | Local evidence |
| --- | --- | --- |
| Chromium | ATK → AT-SPI | Smart detection and insertion passed in an isolated browser |
| Brave | ATK → AT-SPI | Same full path passed with Brave's native executable |
| Chrome | Same Chromium interface | Adapter recognizes it; binary unavailable locally |
| Firefox | Gecko ATK → AT-SPI | Attribute aliases and application identity supported; not locally tested |
| Zen | Gecko ATK → AT-SPI | Same adapter route; binary unavailable locally |
| GTK 4 | Native AT-SPI | Supports direct `EditableText`; see local validation report |

Blip enables the accessibility bus's `IsEnabled` property while starting the
feature. It does not set `ScreenReaderEnabled` or launch a screen reader. The
shared accessibility facility stays enabled when this client exits, since other
clients may be using it.

On the tested Chromium and Brave builds, reliable web metadata required the
native launch option `--force-renderer-accessibility=complete`, as well as an
enabled accessibility bus. Enabling the bus alone did not produce usable field
events in our isolated Chromium test. The browser's environment must omit
`NO_AT_BRIDGE`; setting it to `0` was insufficient here. The feature's own helper
uses a clean environment. No system-wide environment override is installed.

The local installation adds the launch option to the existing Chromium and
Brave flag files, preserving their other options. Already-running browsers need
a normal relaunch to pick up launch options. They can use the manual fallback
in the meantime. No extension installation or remote-debugging option is added.

Adapters normalize browser-specific native attribute names in `otp-desktop.py`.
Future browser-specific changes belong there, rather than in page scripts.
This is a common OS interface, not a claim that every browser and website
exposes equally complete metadata.

## Current limits

Labels are heuristic and currently English-oriented. Initial focus that predates
the helper can require refocusing the field before smart mode appears. Separate
one-character OTP boxes, cross-field auto-advance, custom canvas widgets and
incomplete accessibility trees are not fully supported. Chromium field geometry on Wayland is converted from physical pixels to the
compositor's logical coordinates; other browser/toolkit coordinate conventions
may need an adapter adjustment. Known fields that cannot
hold the complete code are rejected. Unknown browsers can be added to the
application-identity adapter; accessible web documents are also recognized.

No automatic submission is sent by Blip, but a site may itself submit when its
last digit is entered. A focus change during insertion can leave a partial code.
Five-minute expiry clears the autofill reference, not the original message in
Messages or Blip's existing conversation model. Managed runtimes do not promise
forensic zeroization of all freed string storage.

## Configuration and installation

The feature is opt-in through the existing `~/.config/blip/bridge.conf`:

```ini
otp_autofill=on
```

Dependencies are Blip's Bun runtime, Python 3 with PyGObject/AT-SPI, and Hyprland's
Lua `send_key_state` dispatcher with window targeting. `OtpRuntime.qml` pins the
absolute Bun executable; the repository template uses `/usr/bin/bun` and a local
installer must substitute the actual installed location. The Python executable
is `/usr/bin/python3`, launched in isolated mode.

Start from the complete Blip 2.5.0 tree (including its `.mjs` modules), then
install the three changed QML files (`BarWidget.qml`, `BlipView.qml`,
`BlipWindow.qml`) and the six new runtime files (`OtpAutofill.qml`, `OtpRuntime.qml`, `otp-autofill.ts`,
`otp-policy.ts`, `otp-desktop.py`, `BlipAppearance.qml`) in the user-owned Blip plugin. Restart with
`omarchy restart shell` after QML changes; Blip's existing IPC handler can otherwise
remain attached to the old widget. `nixfred.blip status` reports
`autofill=off|starting|ready`. No second Quickshell instance is needed.

To disable, remove `otp_autofill=on` or set it to `off`. The helper and prompt stop.
A full rollback restores the backed-up Blip files and removes only the added
browser launch option, then restarts the shell. Local updates to Blip may overwrite
this unmerged enhancement; keep the patch and original revision.

## Privacy and bounded interfaces

Codes stay on the existing message stream and internal process pipes. The prompt
shows no code digits; notifications suppress recognized code bodies when autofill
is enabled. The new feature creates no OTP state file or clipboard entry. Blip's
existing state stores only opaque code-message digests for deduplication.

Frames are capped at 4096 bytes. There is one pending code, a bounded deduplication
map, finite accessibility and socket timeouts, and a short metadata lease. Socket
parents are walked with held directory descriptors and symlinks refused; the
Hyprland peer UID is checked. Helpers exit when their owning pipe closes. The
new runtime does not log code text, labels, or document origins. Existing Blip
code outside this change still has its own privacy and security behavior; this
feature is not a full audit or marketplace verification of the whole repository.

## Research sources

- [Chromium accessibility overview](https://chromium.googlesource.com/chromium/src/+/main/docs/accessibility/overview.md): native Linux ATK tree, focus events, actions and launch modes.
- [Mozilla accessibility architecture](https://firefox-source-docs.mozilla.org/accessible/Architecture.html): native Linux ATK objects, including unified page/frame trees.
- [AT-SPI document attributes](https://gnome.pages.gitlab.gnome.org/at-spi2-core/libatspi/method.Document.get_document_attributes.html) and [EditableText](https://gnome.pages.gitlab.gnome.org/at-spi2-core/libatspi/method.EditableText.set_text_contents.html): metadata and direct text insertion APIs.
- [Hyprland dispatchers](https://wiki.hypr.land/0.55.0/Configuring/Basics/Dispatchers/): window-targeted key events.
- [Wayland text-input protocol](https://cgit.freedesktop.org/wayland/wayland-protocols/tree/unstable/text-input/text-input-unstable-v3.xml): input hints travel between clients and the compositor/IME; this is not a general API for another client to inspect every browser field or its label.
- [Omarchy plugin development](https://plugins.omarchy.org/develop.html) and [the requested security skill](https://github.com/wbso-ai/omarchy-plugin-security-skill): one shell process, theme controls, bounded transports, secret handling and lifecycle.

A browser extension can expose DOM details directly, but the working AT-SPI tests
show that an extension is not a prerequisite. OS accessibility is the primary
route here. OCR lacks dependable field semantics, and DevTools would add browser
setup and debugging exposure, so neither is part of the implementation.
