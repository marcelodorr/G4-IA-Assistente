import { db } from "@/lib/db";
import { listAssistantsForUser } from "@/lib/services/assistants";
import { getSettings } from "@/lib/services/settings";
import { NewChat } from "@/components/chat/new-chat";
import { SUPPORTED_MODELS } from "@/lib/ai/models";
import { auth } from "@/lib/auth";
import { filterUserModels, getUserAccess } from "@/lib/services/users";
import { listUserIntegrations } from "@/lib/services/integrations";
import { listProjects } from "@/lib/services/projects";

export const dynamic = "force-dynamic";

export default async function NewChatPage({ searchParams }: { searchParams: Promise<{ prompt?: string; project?: string }> }) {
  const session = (await auth())!;
  const [assistentes, settings, access, integrations, projects, params] = await Promise.all([
    listAssistantsForUser(db, session.user.id),
    getSettings(db),
    getUserAccess(db, session.user.id),
    listUserIntegrations(db, session.user.id),
    listProjects(db, session.user.id),
    searchParams,
  ]);
  // Só os campos necessários para o seletor chegam ao client — nunca o systemPrompt.
  const assistants = assistentes.map(({ id, name, description, agentType, integrationProvider }) => ({ id, name, description, agentType, integrationProvider }));
  const globallyEnabled = SUPPORTED_MODELS.filter((model) => !settings.disabledModels.includes(model));
  const models = filterUserModels(globallyEnabled, access.allowedModels);
  const defaultModel = models.includes(settings.defaultModel) ? settings.defaultModel : models[0] ?? null;
  const integrationSuggestions = integrations.filter((item) => item.connected).flatMap((item) => item.examplePrompts.slice(0, 1));
  const initialPrompt = typeof params.prompt === "string" ? params.prompt.slice(0, 12_000) : "";
  const initialProjectId = typeof params.project === "string" && projects.some((project) => project.id === params.project) ? params.project : null;
  return <NewChat assistants={assistants} projects={projects.map(({ id, name }) => ({ id, name }))} initialProjectId={initialProjectId} defaultModel={defaultModel} models={models} initialPrompt={initialPrompt} integrationSuggestions={integrationSuggestions} />;
}
