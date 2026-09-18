# Blip weekly contributor notes

Working notes for the PUBLIC weekly Blip update that @nixfred posts. One section
per ISO week, newest first. Notes go in the same turn the work lands, never
reconstructed on Sunday from memory.

**How these notes are kept (Fred, standing, 2026-09-18)**
- Every merged PR gets a line THE DAY IT MERGES: number, one sentence a
  non-contributor understands, the contributor's real name, and their X handle
  as a link when it is verified (rules and the verified list: `CHANGE.log`).
- Record what was actually verified and the real numbers, because that is what
  makes the post worth reading: measured before/after, tests run, what was NOT
  checked.
- Credit the reporter of a bug as well as its fixer.
- Anything a contributor should know that is not in the diff (a trade-off, a
  follow-up left open, a decision that went against their PR) goes here too.
- On Sunday the week's section becomes one post, drafted into `X-POSTS.md`, and
  the section is marked POSTED with the link. Nothing is posted by Larry; Fred
  reads and posts.
- A week with no merges still gets a section saying so. Silence is data.

---

## 2026-W38 (Mon 14 Sep to Sun 20 Sep): OPEN, post due Sun 20 Sep

19 PRs merged so far, from 6 people.

### Mon 15 Sep: ten merges, the Codex-audit backlog cleared

- **#80 stamps cross the bridge as UTC, local time is a display concern.** Zach
  Wilke, https://x.com/zachwilke_1. Reported by cjoh (GitHub, no handle found).
  The Mac's naive clock compared against a Linux clock meant nothing counted as
  unread one way and the backlog re-toasted the other, and in the DST fall-back
  hour two messages an hour apart carried the same stamp. Consequence for
  anyone still on an old bridge: stamps are normalised at the two fetch doors,
  so a half-upgraded pair keeps working.
- **#81 animated GIFs arrive as their own bytes.** Zach Wilke. The Mac
  resampled every image with sips, so a 1.4 MB GIF reached Linux as a 198 KB
  still, motion gone before the panel saw it.
- **#82 a message carries every file you drop.** Zach Wilke. Dropping five
  photos attached one and discarded four silently. Capped at ten, caption on
  the first part only.
- **#84 docs: outbound tapbacks are half possible on macOS 26.** Zach Wilke.
  Menu items exist and are scriptable; what is unsolved is selecting a bubble
  remotely. Do not quote the old "impossible" note.
- **#75 a 3-4 digit short code is a DM, not a group.** Ian Swope (no verified X
  handle). 611 and 2536 opened read-only, so you could not reply STOP.
- **#76 no toast for the conversation you already have open.** Ian Swope.
- **#77 README allowlist and mutelist examples now parse.** Ian Swope. Copied as
  shown, they configured nothing and said nothing.
- **#85 follower bars stop toasting on every extra monitor.** Ian Swope. Docked
  to two externals, every message fired three toasts. Every bar crowned itself
  leader for the first few hundred ms after a hotplug.
- **#88 the panel no longer hangs half-faded.** Ian Swope. Measured with a
  frame-gap probe: 441 to 627 ms of blocked GUI thread per open, because the
  list rendered all 300 rows when ten are on screen.
- **#87 the app window stays on its workspace after idle.** Danny Cecil,
  https://x.com/jefehoser.

### Tue 16 Sep: four merges

- **#95 a message read on another device never toasts.** Ian Swope, fixing #89
  reported by Marshall Huss, https://x.com/mwhuss. Waking the laptop replayed
  the night as up to twenty toasts, including messages already read on the
  iPhone.
- **#93 Super+M only ever touches the real Blip window.** Danny Cecil,
  https://x.com/jefehoser. It matched any title starting with "Blip", so a
  browser tab called "Blip documentation" got closed instead. Users must
  re-copy the binding from the README; updating the plugin cannot change a
  Hyprland config.
- **#94 right-click a message to quote or copy it.** Danny Cecil. Behaviour
  change worth flagging in the post: right-click on text used to copy
  instantly, now it opens a menu.
- **#92 a security code offered beside the field that wants it.** Brenden
  Bishop, https://x.com/bbishdotdev. Opt in with `otp_autofill=on`. Tested in a
  VM before merge: the labelled field and six separate digit boxes both filled,
  a field labelled Message got no prompt, the clipboard never held a code. Be
  honest in the post: a plain unlabelled field gets a manual prompt and a click
  puts the code there, which is documented design, not a defect.

### Wed 17 Sep: five merges

- **#98 one never-opened unread no longer slows every poll.** Ian Swope. The
  fetch boundary was one global minimum, so a single dot nobody opened set the
  depth for every poll: 150 rows doubling to 8192 across that many sequential
  ssh calls. His measurement, a 45-day dot: 6 calls, 4798 rows, 3.18 s against a
  6 s timer. Re-measured here on a crafted six-week-old dot against the live
  bridge, twice each: 1.8 s to 0.63 s, same unread count. Follow-up left open
  and worth saying out loud: `imsg thread` bounds by rows, not date, so a
  `--since` on the bridge would make each of these one exact call.
- **#101 a read dot no longer returns while the badge says zero.** Damon Janis,
  https://x.com/damonjanis. The no-op cache did not move when an optimistic
  read mutated the model. First real QML regression test in the repo: it runs
  the shipping bar code under Qt, 6 pass, and 2 fail against the old code
  (verified both ways here).
- **#102 a read push is done only when the Mac's count reaches zero.** Damon
  Janis. 3 to 2 exited 0, and so did "cannot verify". Trade-off for the post: a
  message landing inside the three-second settle now reports failure for a push
  that cleared what it could. Neither of us tested it live, because that means
  marking every conversation read on a real account.
- **#96 `prefer_imessage=on` keeps a mixed 1:1 on iMessage.** Baden,
  https://x.com/bhp35. One RCS inbound turned every later send green and the
  Mac logged SMS error 4 while the iPhone had delivered. Off by default. Say
  plainly: an old successful iMessage counts, so a contact who moved to Android
  is tried on iMessage until a send fails.
- **#99 CLAUDE.md records rank-then-size for contact sources.** Ian Swope,
  catching our own note going stale the same day the code changed.

### Ours this week, for context in the post, not credit
- Blip 2.5.0 shipped Sun 13 Sep.
- A waiting Send Later message showed as already sent and became a
  conversation's newest message; fixed 16 Sep. Found checking macOS 27.
- Everything Blip taught us about the Mac helpers went upstream as
  claude-on-mac v2.0.0 (16 Sep), including the group-send -1728 fix, macOS 26
  unsend detection, region-aware phone matching and UTC stamps.
- macOS 27 (27.0, 26A428) verified: every read path, contacts, photos, sending.
- vic ran an old Blip against the updated bridge and showed every message at
  12:00am. Our miss, not a contributor's: a bridge change has to reach every
  client in the same step.

### Standing items to mention when they resolve
- Ian Swope has 12 merged PRs and no X handle anyone can verify. If someone
  knows it, we tag him properly.
- #83 (Zach Wilke, hold the Mac channel open) is still blocked on the socket
  ownership review and conflicts with main.
- #100 (cw228, `bin_dir=`) conflicts with main.
- #90 and #91 (Kb2uka, delete messages, save contacts) are still drafts.

---

## 2026-W37 (Mon 8 Sep to Sun 14 Sep): not posted weekly at the time

Covered by the long contributor post of 11 Sep (`CONTRIBUTORS-X-POST.md`, 51
PRs, 15 contributors) plus the 13 Sep merges: #54 (Jon Kinney,
https://x.com/jondkinney, sending a link no longer opens the share sheet), #71,
#72, #73, #74 (Ian Swope: `blip-setup` stdin, plain-text sinks, a copied
security code no longer lingering in /proc, README removal instructions).
Blip 2.5.0 shipped on 13 Sep.
