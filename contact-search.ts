#!/usr/bin/env bun
/**
 * Blip contact search — powers the new-conversation composer.
 *
 *   bun contact-search.ts <query>   →  {ok, online, error, results}
 *
 * Backed by `contacts --json dump` on the Mac (AddressBook), cached locally
 * and filtered with a subsequence score. Every phone and email of a matching
 * contact becomes its own row, because each is its own iMessage handle.
 * A query that already LOOKS like a handle (phone/email)
 * gets a direct "message this" row first — you can text a number that is in
 * nobody's contacts.
 */

import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { spawnSync } from "node:child_process";

const HOME = process.env.HOME ?? homedir();

export interface ContactHit {
  /** "Mom" / "Tim McClusky" / the raw handle for direct entry. */
  name: string;
  /** The sendable handle: +1404… or an email. */
  handle: string;
  /** "mobile" label, "email", or "direct entry". */
  kind: string;
}

/** "(404) 555-0123" → "+14045550123"; keeps +intl and emails untouched.
 *  Bare 10-digit numbers are assumed US (+1) — that matches how chat.db
 *  stores handles for a US user. Anything AMBIGUOUS returns "" and the row
 *  is dropped: a number with an extension ("… ext 4") or an odd digit count
 *  must never be silently rewritten into a DIFFERENT dialable number
 *  (Codex HIGH, 1.2.0 review). */
/** Country calling code for bare national numbers: `country_code=` in
 *  ~/.config/blip/bridge.conf (default 1 — NANP). Read once; tests pass it. */
export function defaultCountryCode(): string {
  try {
    const conf = readFileSync(join(process.env.XDG_CONFIG_HOME ?? join(HOME, ".config"), "blip", "bridge.conf"), "utf8");
    const m = /^\s*country_code\s*=\s*['"]?(\d{1,3})/m.exec(conf);
    if (m) return m[1];
  } catch { /* no conf: NANP */ }
  return "1";
}

export function normalizeHandle(s: string, cc: string = defaultCountryCode()): string {
  const t = String(s || "").trim();
  if (t.includes("@")) return t.toLowerCase();
  // Extensions can't be messaged; stripping them would change the number.
  if (/(ext|x)\.?\s*=?\s*\d+\s*$/i.test(t) || /[;,]/.test(t)) return "";   // ";ext=89" too (Astra B#10)
  if (t.startsWith("+")) return "+" + t.slice(1).replace(/\D/g, "");
  const digits = t.replace(/\D/g, "");
  if (cc === "1") {
    if (digits.length === 10) return "+1" + digits;
    if (digits.length === 11 && digits.startsWith("1")) return "+" + digits;
    return "";
  }
  // Outside NANP: a national number with a leading trunk 0 dropped, or
  // already prefixed with the country code. Lengths vary; accept 6–12 digits.
  if (digits.startsWith(cc) && digits.length >= cc.length + 6) return "+" + digits;
  const national = digits.replace(/^0/, "");
  if (national.length >= 6 && national.length <= 12) return "+" + cc + national;
  return "";
}

/** Does the query itself already name a sendable handle? */
export function directHandle(q: string): string {
  const t = String(q || "").trim();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) return t.toLowerCase();
  const digits = t.replace(/[()\s.-]/g, "");
  if (/^\+?[0-9]{7,15}$/.test(digits)) return normalizeHandle(digits);
  return "";
}

interface RawContact {
  name?: string;
  org?: string;
  nick?: string;
  phones?: { number?: string; label?: string }[];
  emails?: { address?: string; label?: string }[] | string[];
}

/** Subsequence match. 0 means no match. Consecutive and word-start hits score higher. */
export function fuzzyScore(query: string, text: string): number {
  const q = String(query || "").trim().toLowerCase();
  const t = String(text || "").toLowerCase();
  if (q === "" || t === "") return 0;
  if (t.includes(q)) return 1000 + (t.startsWith(q) ? 100 : 0) - Math.min(t.length, 100);
  let ti = 0;
  let score = 0;
  let consec = 0;
  for (let qi = 0; qi < q.length; qi++) {
    const idx = t.indexOf(q[qi]!, ti);
    if (idx < 0) return 0;
    if (idx === ti) {
      consec += 1;
      score += 10 + consec;
    } else {
      consec = 0;
      score += 1;
    }
    if (idx === 0 || /\s/.test(t[idx - 1]!)) score += 20;
    ti = idx + 1;
  }
  return score;
}

export function contactHaystack(c: RawContact): string {
  const emails = (c.emails ?? []).map((e) => (typeof e === "string" ? e : String(e.address || "")));
  const phones = (c.phones ?? []).map((p) => String(p.number || ""));
  return [c.name, c.org, c.nick, emails.join(" "), phones.join(" ")].filter(Boolean).join(" ");
}

export function filterFuzzy(raw: RawContact[], query: string): RawContact[] {
  const q = String(query || "").trim();
  if (q === "") return [];
  return raw.filter((c) => fuzzyScore(q, contactHaystack(c)) > 0);
}

export function shapeContacts(raw: RawContact[], query: string, limit = 30): ContactHit[] {
  const out: ContactHit[] = [];
  const seen = new Set<string>();
  const direct = directHandle(query);
  if (direct !== "") {
    out.push({ name: direct, handle: direct, kind: "direct entry" });
    seen.add(direct);
  }
  for (const c of raw) {
    const name = String(c.name || "").trim() || "(unnamed)";
    for (const p of c.phones ?? []) {
      const h = normalizeHandle(String(p.number || ""));
      if (h.length < 8 || seen.has(h)) continue;
      seen.add(h);
      // Apple stores labels as "_$!<Mobile>!$_" — unwrap them.
      const label = String(p.label || "").replace(/^_\$!<|>!\$_$/g, "").trim();
      out.push({ name, handle: h, kind: label.toLowerCase() || "phone" });
    }
    for (const e of c.emails ?? []) {
      const addr = typeof e === "string" ? e : String(e.address || "");
      const h = normalizeHandle(addr);
      if (!h.includes("@") || seen.has(h)) continue;
      seen.add(h);
      out.push({ name, handle: h, kind: "email" });
    }
    if (out.length >= limit) break;
  }
  return out.slice(0, limit);
}

/** Newer `last_ts` first. Direct-entry rows stay at the top. Unknown
 *  handles keep their original order among themselves. */
export function rankByRecency(hits: ContactHit[], recency: Record<string, string>): ContactHit[] {
  const ts = (h: ContactHit) => recency[h.handle] || "";
  const direct = hits.filter((h) => h.kind === "direct entry");
  const rest = hits.filter((h) => h.kind !== "direct entry");
  rest.sort((a, b) => {
    const ta = ts(a);
    const tb = ts(b);
    if (ta === tb) return 0;
    return ta < tb ? 1 : -1;
  });
  return direct.concat(rest);
}

export interface ContactSearchOutput {
  ok: boolean;
  online: boolean;
  error: string;
  results: ContactHit[];
}

export function searchContacts(
  query: string,
  runner = spawnSync,
  recency: Record<string, string> = {},
): ContactSearchOutput {
  const fail = (error: string, online = true): ContactSearchOutput =>
    ({ ok: false, online, error, results: [] });
  const q = String(query || "").trim();
  if (q === "") return fail("empty query");

  const raw = loadContacts(runner);
  if (raw === "offline") return fail("Mac unreachable", false);
  if (typeof raw === "string") {
    const direct = directHandle(q);
    if (direct !== "") return { ok: true, online: true, error: "", results: rankByRecency(shapeContacts([], q), recency) };
    return fail(raw);
  }
  return {
    ok: true,
    online: true,
    error: "",
    results: rankByRecency(shapeContacts(filterFuzzy(raw, q), q, 1000), recency).slice(0, 30),
  };
}

const DUMP_TTL_MS = 60_000;

function slimContact(c: RawContact): RawContact {
  return { name: c.name, org: c.org, nick: c.nick, phones: c.phones, emails: c.emails };
}

function loadContacts(runner: typeof spawnSync): RawContact[] | "offline" | string {
  const cacheDir = join(process.env.XDG_RUNTIME_DIR ?? `/run/user/${process.getuid?.() ?? 1000}`, "blip");
  const cachePath = join(cacheDir, "contacts-dump.json");
  try {
    if (Date.now() - statSync(cachePath).mtimeMs < DUMP_TTL_MS) {
      const parsed = JSON.parse(readFileSync(cachePath, "utf8"));
      if (Array.isArray(parsed)) return (parsed as RawContact[]).map(slimContact);
    }
  } catch { /* miss */ }
  const res = runner(`${HOME}/bin/contacts`, ["--json", "dump"], {
    encoding: "utf8",
    timeout: 15000, maxBuffer: 64 * 1024 * 1024,
  });
  if (res.status === 69 || res.status === 255) return "offline";
  if (res.status !== 0) {
    const err = (res.stderr || "").toString().trim().split("\n")[0] || `contacts exit ${res.status}`;
    return err;
  }
  try {
    const parsed = JSON.parse(res.stdout as string);
    if (!Array.isArray(parsed)) throw new Error("not an array");
    const slim = (parsed as RawContact[]).map(slimContact);
    try {
      mkdirSync(cacheDir, { mode: 0o700, recursive: true });
      writeFileSync(cachePath, JSON.stringify(slim), { mode: 0o600 });
    } catch { /* cache is optional */ }
    return slim;
  } catch (e) {
    return `bad JSON from contacts: ${e}`;
  }
}

/** Parse the recency map, from wherever it came. Anything unexpected is
 *  simply no recency — ranking degrades, nothing breaks. */
export function parseRecency(raw: string): Record<string, string> {
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed)) if (typeof v === "string" && v !== "") out[k] = v;
    return out;
  } catch { return {}; }
}

if (import.meta.main) {
  try {
    // The recency map is every handle you have a thread with — your whole
    // contact graph. On argv that is readable by any process on this machine
    // through `ps`, which is the same reason message text has never travelled
    // that way. So it comes in on STDIN. `--recency <json>` stays for a human
    // poking at the CLI; QML always uses stdin.
    const argv = process.argv.slice(2);
    const flag = argv.indexOf("--recency");
    const recency = argv.includes("--recency-stdin")
      ? parseRecency(readFileSync(0, "utf8"))
      : flag >= 0
        ? parseRecency(argv[flag + 1] ?? "")
        : {};
    const query = argv.find((a, i) =>
      !a.startsWith("--") && !(flag >= 0 && i === flag + 1)) ?? "";
    console.log(JSON.stringify(searchContacts(query, spawnSync, recency)));
  } catch (e) {
    console.log(JSON.stringify({ ok: false, online: true, error: String(e), results: [] }));
  }
}
