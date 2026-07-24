import { describe, expect, it } from "vitest";
import { parseChatSelections } from "./chat-selections";

describe("parseChatSelections", () => {
  it("remove duplicatas e aceita seleções válidas", () => {
    expect(parseChatSelections({ generationMode: "image", selectedIntegrationIds: ["gitbook", "gitbook"], selectedSkillIds: ["skill-1"] })).toEqual({ generationMode: "image", selectedIntegrationIds: ["gitbook"], selectedSkillIds: ["skill-1"] });
    expect(parseChatSelections({})).toEqual({ generationMode: "chat", selectedIntegrationIds: [], selectedSkillIds: [] });
  });
  it("rejeita providers e payloads forjados", () => {
    expect(() => parseChatSelections({ selectedIntegrationIds: ["invasor"] })).toThrow(/inválida/i);
    expect(() => parseChatSelections({ selectedSkillIds: "skill-1" })).toThrow(/inválidas/i);
    expect(() => parseChatSelections({ generationMode: "video" })).toThrow(/modo de geração inválido/i);
  });
});
