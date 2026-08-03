import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyRecallRequest } from "./recall";

describe("Recall.ai webhook verification", () => {
  it("aceita a assinatura HMAC válida e rejeita payload adulterado", () => {
    const key = Buffer.from("segredo-de-teste-comprido");
    const secret = `whsec_${key.toString("base64")}`;
    const id = "msg_teste";
    const timestamp = String(Math.floor(Date.now() / 1_000));
    const payload = JSON.stringify({ event: "transcript.data" });
    const signature = createHmac("sha256", key).update(`${id}.${timestamp}.${payload}`).digest("base64");
    const headers = new Headers({ "webhook-id": id, "webhook-timestamp": timestamp, "webhook-signature": `v1,${signature}` });
    expect(() => verifyRecallRequest(secret, headers, payload)).not.toThrow();
    expect(() => verifyRecallRequest(secret, headers, `${payload}x`)).toThrow(/assinatura/i);
  });
});
