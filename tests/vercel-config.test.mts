import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { readAuthConfigFile, readGlobalConfigFile } from "@vercel/cli-config";

// The Blob SDK's OIDC refresh uses these readers. Exercise their public API
// after patching the transitive Zod pin, without reading a real CLI credential.
test("Vercel global settings retain their values and unknown keys", () => {
  const dir = mkdtempSync(join(tmpdir(), "pluma-vercel-config-"));
  try {
    const path = join(dir, "config.json");
    const settings = { currentTeam: "team_fixture", credStorage: "file", telemetry: { enabled: false }, futureSetting: true };
    writeFileSync(path, JSON.stringify(settings));
    assert.deepEqual(readGlobalConfigFile(path), settings);
    writeFileSync(path, JSON.stringify({ currentTeam: 123 }));
    assert.throws(() => readGlobalConfigFile(path));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("Vercel auth settings retain refresh fields and reject an invalid expiry", () => {
  const dir = mkdtempSync(join(tmpdir(), "pluma-vercel-auth-"));
  try {
    const path = join(dir, "auth.json");
    const settings = { token: "fixture-only", refreshToken: "fixture-refresh", expiresAt: 1900000000 };
    writeFileSync(path, JSON.stringify(settings));
    assert.deepEqual(readAuthConfigFile(path), settings);
    writeFileSync(path, JSON.stringify({ ...settings, expiresAt: "not-a-number" }));
    assert.throws(() => readAuthConfigFile(path));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
