import test from "node:test";
import assert from "node:assert/strict";
import { isMetadataOnlyPath, isSensitivePath, redactText } from "../utils/redact.js";

test("sensitive path classifier flags secrets and sessions", () => {
  assert.equal(isSensitivePath("/tmp/.env"), true);
  assert.equal(isSensitivePath("/Users/me/.ssh/id_rsa"), true);
  assert.equal(isSensitivePath("/Users/me/project/AGENTS.md"), false);
});

test("metadata-only classifier flags known local config shapes", () => {
  assert.equal(isMetadataOnlyPath("/Users/me/.claude/settings.json"), true);
  assert.equal(isMetadataOnlyPath("/Users/me/project/.claude/launch.json"), true);
  assert.equal(isMetadataOnlyPath("/Users/me/project/AGENTS.md"), false);
});

test("redaction utility removes obvious credential strings", () => {
  const redacted = redactText('token="secret-value" sk-test-value-1234567890 AKIAABCDEFGHIJKLMNOP');
  assert.match(redacted, /\[REDACTED\]/);
  assert.match(redacted, /\[REDACTED_API_KEY\]/);
  assert.match(redacted, /\[REDACTED_AWS_KEY\]/);
});
