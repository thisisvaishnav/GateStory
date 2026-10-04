import { describe, expect, it } from "vitest";
import { signPayload, verifyRingSignature } from "../src/ring/verifier.js";

describe("Ring HMAC-SHA256 Signature Verification", () => {
  const TEST_KEY = "test_secret_hmac_key_987654321";
  const SAMPLE_BODY = JSON.stringify({
    action: "event",
    device_id: "device-gate-01",
    event_type: "motion",
  });

  it("should generate valid signature format sha256=<hex>", () => {
    const signature = signPayload(SAMPLE_BODY, TEST_KEY);
    expect(signature).toMatch(/^sha256=[a-f0-9]{64}$/);
  });

  it("should successfully verify a valid HMAC signature", () => {
    const signature = signPayload(SAMPLE_BODY, TEST_KEY);
    const result = verifyRingSignature(SAMPLE_BODY, signature, TEST_KEY);
    expect(result.valid).toBe(true);
  });

  it("should accept raw hex signature without sha256= prefix", () => {
    const signature = signPayload(SAMPLE_BODY, TEST_KEY);
    const rawHex = signature.slice(7);
    const result = verifyRingSignature(SAMPLE_BODY, rawHex, TEST_KEY);
    expect(result.valid).toBe(true);
  });

  it("should reject tampered payload with valid signature", () => {
    const signature = signPayload(SAMPLE_BODY, TEST_KEY);
    const tamperedBody = JSON.stringify({
      action: "event",
      device_id: "device-gate-01",
      event_type: "ding", // changed!
    });
    const result = verifyRingSignature(tamperedBody, signature, TEST_KEY);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("verification failed");
  });

  it("should reject incorrect HMAC key", () => {
    const signature = signPayload(SAMPLE_BODY, TEST_KEY);
    const result = verifyRingSignature(SAMPLE_BODY, signature, "wrong_key");
    expect(result.valid).toBe(false);
  });

  it("should reject missing signature header", () => {
    const result = verifyRingSignature(SAMPLE_BODY, undefined, TEST_KEY);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("Missing X-Signature header");
  });

  it("should reject signature length mismatch safely without throwing", () => {
    const result = verifyRingSignature(SAMPLE_BODY, "sha256=tooshort", TEST_KEY);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("Signature length mismatch");
  });
});
