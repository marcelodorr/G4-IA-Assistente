import { describe, expect, it } from "vitest";
import { fetchExternalSite } from "./external-site";

describe("fetchExternalSite", () => {
  it.each(["http://localhost/admin", "file:///etc/passwd", "http://127.0.0.1/"])("bloqueia endereço interno ou protocolo inseguro: %s", async (url) => {
    await expect(fetchExternalSite(url)).rejects.toThrow(/interno|HTTP ou HTTPS/i);
  });
});
