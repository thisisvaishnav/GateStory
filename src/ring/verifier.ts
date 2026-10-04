import crypto from "node:crypto";

export interface VerifySignatureResult {
  valid: boolean;
  reason?: string;
  expectedSignature?: string;
  receivedSignature?: string;
}

/**
 * Computes the Ring HMAC-SHA256 signature for a raw request body.
 * Format: sha256=<hex_digest>
 */
export function signPayload(rawBody: string | Buffer, hmacKey: string): string {
  const bodyBuffer = typeof rawBody === "string" ? Buffer.from(rawBody, "utf8") : rawBody;
  const hmac = crypto.createHmac("sha256", hmacKey);
  hmac.update(bodyBuffer);
  const hex = hmac.digest("hex");
  return `sha256=${hex}`;
}

/**
 * Verifies the X-Signature header sent by Ring webhook.
 * - Extracts sha256=<hex>
 * - Performs constant-time comparison via crypto.timingSafeEqual
 * - Fails safely if signature is missing or malformed
 */
export function verifyRingSignature(
  rawBody: Buffer | string,
  signatureHeader: string | null | undefined,
  hmacKey: string,
): VerifySignatureResult {
  if (!hmacKey) {
    return {
      valid: false,
      reason: "Server missing RING_HMAC_KEY configuration",
    };
  }

  if (!signatureHeader) {
    return {
      valid: false,
      reason: "Missing X-Signature header",
    };
  }

  // Ring format: sha256=<hex> or raw hex
  const cleanReceived = signatureHeader.startsWith("sha256=")
    ? signatureHeader.slice(7)
    : signatureHeader;

  const bodyBuffer = typeof rawBody === "string" ? Buffer.from(rawBody, "utf8") : rawBody;
  const hmac = crypto.createHmac("sha256", hmacKey);
  hmac.update(bodyBuffer);
  const expectedHex = hmac.digest("hex");

  const expectedBuffer = Buffer.from(expectedHex, "utf8");
  const receivedBuffer = Buffer.from(cleanReceived, "utf8");

  if (expectedBuffer.length !== receivedBuffer.length) {
    return {
      valid: false,
      reason: "Signature length mismatch",
      receivedSignature: cleanReceived,
      expectedSignature: expectedHex,
    };
  }

  const isMatch = crypto.timingSafeEqual(expectedBuffer, receivedBuffer);

  if (!isMatch) {
    return {
      valid: false,
      reason: "HMAC signature verification failed",
      receivedSignature: cleanReceived,
      expectedSignature: expectedHex,
    };
  }

  return {
    valid: true,
  };
}
