// The bridge shim to spawn. Every Linux-side call to the Mac goes through here,
// so `bin_dir=` in bridge.conf moves all of them at once.
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { parseBinDir } from "./bin-dir";

export type ShimTool = "imsg" | "imsg-send" | "imsg-read" | "contacts";

export function shimPath(tool: ShimTool, home: string = process.env.HOME ?? homedir()): string {
  let conf = "";
  try { conf = readFileSync(`${home}/.config/blip/bridge.conf`, "utf8"); } catch { /* no conf: the default */ }
  return `${parseBinDir(conf, home)}/${tool}`;
}
