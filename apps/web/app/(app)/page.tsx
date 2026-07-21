import { db } from "@/lib/db";
import { listAssistants } from "@/lib/services/assistants";
import { getSettings } from "@/lib/services/settings";
import { NewChat } from "@/components/chat/new-chat";

export const dynamic = "force-dynamic";

export default async function NewChatPage() {
  const [assistentes, settings] = await Promise.all([
    listAssistants(db, { onlyActive: true }),
    getSettings(db),
  ]);
  // Só os campos necessários para o seletor chegam ao client — nunca o systemPrompt.
  const assistants = assistentes.map(({ id, name, description }) => ({ id, name, description }));
  return <NewChat assistants={assistants} defaultModel={settings.defaultModel} />;
}
