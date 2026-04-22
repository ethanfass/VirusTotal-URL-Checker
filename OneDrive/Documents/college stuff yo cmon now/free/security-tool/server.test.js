import test from "node:test";
import assert from "node:assert/strict";
import { classifyIndicator, scoreIndicator, triageIndicator } from "./lib/triage.js";

test("classifies common indicator types", () => {
  assert.equal(classifyIndicator("8.8.8.8").type, "ip_address");
  assert.equal(classifyIndicator("44d88612fea8a8f36de82e1278abb02f").type, "file");
  assert.equal(classifyIndicator("https://example.com/path").type, "url");
  assert.equal(classifyIndicator("example.com").type, "domain");
});

test("normalizes URL identifiers as VirusTotal url-safe base64", () => {
  const result = classifyIndicator("https://example.com/login");
  assert.equal(result.id, Buffer.from("https://example.com/login").toString("base64url"));
  assert.equal(result.path, `/urls/${result.id}`);
});

test("scores suspicious URL traits", () => {
  const classification = classifyIndicator("http://login-secure-update.example.com/account/verify");
  const risk = scoreIndicator(
    {
      stats: { malicious: 2, suspicious: 1, harmless: 4, undetected: 20, timeout: 0 },
      reputation: -2,
      votes: { harmless: 0, malicious: 2 }
    },
    classification
  );

  assert.equal(risk.verdict, "Elevated suspicion");
  assert.ok(risk.score >= 50);
  assert.ok(risk.signals.some((signal) => signal.label === "Phishing language"));
});

test("requires backend API key configuration", async () => {
  const originalKey = process.env.VT_API_KEY;
  try {
    delete process.env.VT_API_KEY;

    await assert.rejects(
      () => triageIndicator({ indicator: "example.com" }),
      (error) =>
        error.status === 503 &&
        error.message === "VirusTotal API key is not configured on the backend. Set VT_API_KEY in Netlify environment variables."
    );
  } finally {
    if (originalKey === undefined) {
      delete process.env.VT_API_KEY;
    } else {
      process.env.VT_API_KEY = originalKey;
    }
  }
});
