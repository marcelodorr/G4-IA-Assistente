import { describe, expect, it } from "vitest";
import { parseChatSelections } from "./chat-selections";

describe("parseChatSelections", () => {
  it("remove duplicatas e aceita seleções válidas", () => {
    expect(parseChatSelections({ selectedIntegrationIds: ["gitbook", "gitbook"], selectedSkillIds: ["skill-1"] })).toEqual({ selectedIntegrationIds: ["gitbook"], selectedSkillIds: ["skill-1"] });
  });
  it("rejeita providers e payloads forjados", () => {
    expect(() => parseChatSelections({ selectedIntegrationIds: ["invasor"] })).toThrow(/inválida/i);
    expect(() => parseChatSelections({ selectedSkillIds: "skill-1" })).toThrow(/inválidas/i);
  });
});
