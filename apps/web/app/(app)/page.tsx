import { db } from "@/lib/db";
import { listAssistants } from "@/lib/services/assistants";
import { getSettings } from "@/lib/services/settings";
import { NewChat } from "@/components/chat/new-chat";

export const dynamic = "force-dynamic";

export default async function NewChatPage() {
  const [assistants, settings] = await Promise.all([
    listAssistants(db, { onlyActive: true }),
    getSettings(db),
  ]);
  return <NewChat assistants={assistants} defaultModel={settings.defaultModel} />;
}
