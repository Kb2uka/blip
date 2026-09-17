import { test, expect } from "bun:test";
import { Frames } from "./otp-autofill";

test("private-pipe frames survive partial reads and several messages per read", () => {
  const frames = new Frames(), received: unknown[] = [];
  const first = { type: "focus", label: "Código" };
  for (const byte of Buffer.from(JSON.stringify(first) + "\n"))
    frames.feed(Buffer.from([byte]), event => received.push(event));
  frames.feed(Buffer.from('{"type":"ready"}\n{"type":"hide"}\n'), event => received.push(event));
  expect(received).toEqual([first, { type: "ready" }, { type: "hide" }]);
});

test("oversized complete and unfinished frames refuse before reaching the handler", () => {
  for (const data of [Buffer.alloc(4097, 32), Buffer.from(" ".repeat(4097) + "\n")]) {
    const received: unknown[] = [];
    expect(() => new Frames().feed(data, event => received.push(event))).toThrow();
    expect(received).toEqual([]);
  }
  const frames = new Frames();
  frames.feed(Buffer.alloc(4096, 32), () => {});
  expect(() => frames.feed(Buffer.from(" "), () => {})).toThrow();
  expect(() => new Frames().feed(Buffer.from("invalid\n"), () => {})).toThrow();
});
