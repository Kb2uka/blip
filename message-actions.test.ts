import { expect, test } from "bun:test";
import { quotedDraft, quoteText } from "./message-actions";

test("quote an older message without replacing or normalizing the draft", () => {
  expect(quotedDraft({ text: "An older\nmessage" }, "My reply\n  in progress"))
    .toBe("> An older message\n\nMy reply\n  in progress");
});
test("an empty composer is ready to type beneath the quote", () => {
  expect(quotedDraft({ text: "Hello" }, "")).toBe("> Hello\n\n");
});
test("link-only messages can be quoted", () => {
  expect(quotedDraft({ link: { url: "https://example.com/video" } }, "Yes"))
    .toBe("> https://example.com/video\n\nYes");
});
test("empty and withdrawn messages leave drafts alone", () => {
  for (const message of [{}, { text: "  " }, { text: "Withdrawn", retracted: true }]) {
    expect(quoteText(message)).toBe("");
    expect(quotedDraft(message, "Keep this")).toBe("Keep this");
  }
});
test("long quotations show truncation without splitting an emoji", () => {
  expect(quotedDraft({ text: "🙂".repeat(201) }, "Draft"))
    .toBe("> " + "🙂".repeat(200) + "…\n\nDraft");
});
