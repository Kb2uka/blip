#!/usr/bin/env bun
/** Prepare a restored window and keep it on its last home across remaps. */
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

export function isLiveBlipTitle(title: unknown): boolean {
  return typeof title === "string" && /^Blip( \([0-9]+\))?$/.test(title);
}

export function windowAddress(value: unknown): string | null {
  return typeof value === "string" && /^0x[0-9a-fA-F]+$/.test(value) ? value : null;
}

export type WorkspaceReason = "move" | "map" | "report" | "monitor";

/** User moves become the new home. A remap or monitor churn is a stray. */
export function workspaceDecision(saved: unknown, incoming: unknown, reason: WorkspaceReason): "save" | "return" | "ignore" {
  const next = typeof incoming === "string" ? incoming : "";
  const home = typeof saved === "string" ? saved : "";
  if (!next || /[\x00-\x1f\x7f]/.test(next)) return "ignore";
  if (!home) return reason === "report" ? "ignore" : "save";
  if (next === home) return "ignore";
  if (reason === "move") return "save";
  if (reason === "map" || reason === "monitor") return "return";
  return "ignore";
}

export function restoreRule(workspace: unknown, title: string): string {
  if (!/^Blip-restore-[a-f0-9-]+$/.test(title)) throw new Error("Invalid restore title");
  const target = workspaceSelector(workspace);
  return `hl.window_rule({ name = "blip-session-restore", match = { class = "^org\\\\.quickshell$", title = "^${title}$" }, no_initial_focus = true${target ? `, workspace = ${luaString(target + " silent")}` : ""} })`;
}

export function homeRule(workspace: unknown): string {
  const target = workspaceSelector(workspace);
  return `hl.window_rule({ name = "blip-session-home", match = { class = ${luaString("^org\\.quickshell$")}, title = ${luaString("^Blip( \\([0-9]+\\))?$")} }, no_initial_focus = true${target ? `, workspace = ${luaString(target + " silent")}` : ""} })`;
}

export function silentMove(workspace: unknown, address: unknown): string | null {
  const target = workspaceSelector(workspace);
  const addr = windowAddress(address);
  if (!target || !addr) return null;
  return `hl.dsp.window.move({ workspace = ${luaString(target)}, follow = false, window = ${luaString("address:" + addr)} })`;
}

function hyprEval(lua: string): boolean {
  const result = spawnSync("hyprctl", ["eval", lua], { encoding: "utf8", timeout: 3000 });
  return result.status === 0 && /^ok\s*$/.test(result.stdout);
}

function hyprDispatch(lua: string): boolean {
  const result = spawnSync("hyprctl", ["dispatch", lua], { encoding: "utf8", timeout: 3000 });
  return result.status === 0;
}

if (import.meta.main) {
  const action = process.argv[2] || "prepare";
  if (action === "home") {
    if (!hyprEval(homeRule(process.argv[3]))) {
      console.error("Blip could not keep the window on its workspace");
      process.exit(1);
    }
    process.exit(0);
  }
  if (action === "return") {
    const lua = silentMove(process.argv[3], process.argv[4]);
    if (!lua || !hyprDispatch(lua)) {
      console.error("Blip could not return the window to its workspace");
      process.exit(1);
    }
    process.exit(0);
  }

  const workspace = action === "prepare" ? process.argv[3] : action;
  const title = `Blip-restore-${randomUUID()}`;
  if (!hyprEval(restoreRule(workspace, title))) {
    console.error("Blip could not prepare quiet window restoration");
    process.exit(1);
  }
  if (workspaceSelector(workspace) && !hyprEval(homeRule(workspace))) {
    console.error("Blip could not keep the window on its workspace");
    process.exit(1);
  }
  console.log(JSON.stringify({ title }));
}
