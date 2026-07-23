import { describe, expect, it } from "vitest";
import { INTEGRATIONS, INTEGRATION_PROVIDERS, isIntegrationProvider } from "./catalog";
import { getPublicOrigin } from "./oauth";

describe("integration catalog", () => {
  it("expõe os cinco provedores iniciais", () => {
    expect(INTEGRATION_PROVIDERS).toEqual(["google_calendar", "hubspot", "pipedrive", "apify", "jira"]);
    expect(INTEGRATIONS.apify.authType).toBe("token");
    expect(INTEGRATIONS.jira.scopes).toContain("offline_access");
  });

  it("valida provider e respeita origem pública configurada", () => {
    expect(isIntegrationProvider("hubspot")).toBe(true);
    expect(isIntegrationProvider("dropbox")).toBe(false);
    process.env.APP_URL = "https://sequor.example/";
    expect(getPublicOrigin(new Request("http://internal:3000"))).toBe("https://sequor.example");
    delete process.env.APP_URL;
  });
});
