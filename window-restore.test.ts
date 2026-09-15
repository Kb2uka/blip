import { expect, test } from "bun:test";
import { luaString, restoreRule, workspaceSelector } from "./window-restore";

test("restores numbered, named and special workspaces without relative selectors", () => {
  expect(workspaceSelector("2")).toBe("2");
  expect(workspaceSelector("work")).toBe("name:work");
  expect(workspaceSelector("+1")).toBe("name:+1");
  expect(workspaceSelector("special:scratchpad")).toBe("special:scratchpad");
  expect(workspaceSelector(null)).toBeNull();
  expect(workspaceSelector("bad\nvalue")).toBeNull();
});
test("quiet mapping applies only to the unique restoration window", () => {
  const rule = restoreRule("7", "Blip-restore-abcd-1234");
  expect(rule).toContain('title = "^Blip-restore-abcd-1234$"');
  expect(rule).toContain("no_initial_focus = true");
  expect(rule).toContain(`workspace = ${luaString("7 silent")}`);
  expect(restoreRule(undefined, "Blip-restore-abcd")).not.toContain("workspace =");
  expect(() => restoreRule("2", 'Blip"')).toThrow();
});
test("workspace names cannot inject Lua", () => {
  expect(luaString('"\\\n')).toBe('"\\034\\092\\010"');
  expect(restoreRule('x"}); os.execute("bad', "Blip-restore-abcd")).not.toContain('os.execute');
});
