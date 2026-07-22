import { db } from "@/lib/db";
import { listAssistantsForUser } from "@/lib/services/assistants";
import { getSettings } from "@/lib/services/settings";
import { NewChat } from "@/components/chat/new-chat";
import { SUPPORTED_MODELS } from "@/lib/ai/models";
import { auth } from "@/lib/auth";
import { filterUserModels, getUserAccess } from "@/lib/services/users";

export const dynamic = "force-dynamic";

export default async function NewChatPage() {
  const session = (await auth())!;
  const [assistentes, settings, access] = await Promise.all([
    listAssistantsForUser(db, session.user.id),
    getSettings(db),
    getUserAccess(db, session.user.id),
  ]);
  // Só os campos necessários para o seletor chegam ao client — nunca o systemPrompt.
  const assistants = assistentes.map(({ id, name, description }) => ({ id, name, description }));
  const globallyEnabled = SUPPORTED_MODELS.filter((model) => !settings.disabledModels.includes(model));
  const models = filterUserModels(globallyEnabled, access.allowedModels);
  const defaultModel = models.includes(settings.defaultModel) ? settings.defaultModel : models[0] ?? null;
  return <NewChat assistants={assistants} defaultModel={defaultModel} models={models} />;
}
