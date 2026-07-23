import { afterEach, describe, expect, it, vi } from "vitest";
import { queryGitBook } from "./client";

afterEach(() => vi.unstubAllGlobals());

describe("GitBook client", () => {
  it("pesquisa conteúdo usando Bearer token e parâmetros seguros", async () => {
    const fetchMock = vi.fn(async () => Response.json({ count: 1, items: [{ title: "Manual MES" }] }));
    vi.stubGlobal("fetch", fetchMock);

    await queryGitBook("token-secreto", { action: "search", organizationId: "org_123", query: "implantação MES", limit: 10 });

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/v1/orgs/org_123/search?");
    expect(String(url)).toContain("query=implanta%C3%A7%C3%A3o+MES");
    expect(init?.headers).toMatchObject({ Authorization: "Bearer token-secreto" });
  });

  it("lê página em Markdown e rejeita identificadores inválidos", async () => {
    const fetchMock = vi.fn(async () => Response.json({ id: "page_1", markdown: "# Manual" }));
    vi.stubGlobal("fetch", fetchMock);

    await queryGitBook("token", { action: "get_page", spaceId: "space_1", pageId: "page_1" });
    expect(String(fetchMock.mock.calls[0][0])).toContain("/v1/spaces/space_1/content/page/page_1?format=markdown");
    await expect(queryGitBook("token", { action: "list_spaces", organizationId: "../../segredo" })).rejects.toThrow(/organizationId válido/i);
  });
});
