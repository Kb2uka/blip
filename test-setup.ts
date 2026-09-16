// Tests must never touch the developer's real caches or config: point
// XDG_CACHE_HOME and XDG_CONFIG_HOME at scratch dirs before any module computes
// CACHE_DIR / AVATAR_DIR or reads bridge.conf (country_code= would otherwise
// change what a bare national number normalizes to).
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
process.env.XDG_CACHE_HOME = mkdtempSync(join(tmpdir(), "blip-test-cache-"));
process.env.XDG_CONFIG_HOME = mkdtempSync(join(tmpdir(), "blip-test-config-"));

// Labels are rendered in LOCAL time from UTC wire stamps, so an unpinned TZ
// would make every clock/day assertion depend on where the test ran. Pin it;
// the tests that are ABOUT the conversion set their own zone explicitly.
process.env.TZ ||= "UTC";
