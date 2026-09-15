#!/usr/bin/env bun
/** Prepare a single restored window before it maps. No permanent user rules. */
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";

// Lua quoted strings use decimal escapes, unlike JSON's Unicode escapes.
export function luaString(value: string): string {
  return '"' + Array.from(Buffer.from(value), b => `\\${String(b).padStart(3, "0")}`).join("") + '"';
}

export function workspaceSelector(value: unknown): string | null {
  if (typeof value !== "string" || !value || /[\x00-\x1f\x7f]/.test(value)) return null;
  if (/^[1-9][0-9]*$/.test(value) || value === "special" || value.startsWith("special:")) return value;
  return "name:" + value;
}

export function restoreRule(workspace: unknown, title: string): string {
  if (!/^Blip-restore-[a-f0-9-]+$/.test(title)) throw new Error("Invalid restore title");
  const target = workspaceSelector(workspace);
  return `hl.window_rule({ name = "blip-session-restore", match = { class = "^org\\\\.quickshell$", title = "^${title}$" }, no_initial_focus = true${target ? `, workspace = ${luaString(target + " silent")}` : ""} })`;
}

if (import.meta.main) {
  const title = `Blip-restore-${randomUUID()}`;
  const result = spawnSync("hyprctl", ["eval", restoreRule(process.argv[2], title)], { encoding: "utf8", timeout: 3000 });
  if (result.status !== 0 || !/^ok\s*$/.test(result.stdout)) {
    console.error("Blip could not prepare quiet window restoration");
    process.exit(1);
  }
  console.log(JSON.stringify({ title }));
}
