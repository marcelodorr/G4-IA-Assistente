import { notFound } from "next/navigation";
import type { UIMessage } from "ai";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { getConversation } from "@/lib/services/conversations";
import { assistants } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { Chat } from "@/components/chat/chat";
import { listUserIntegrations } from "@/lib/services/integrations";

export const dynamic = "force-dynamic";

export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = (await auth())!;
  const got = await getConversation(db, id, session.user.id);
  if (!got) notFound();
  const assistant = got.conversation.assistantId
    ? (await db.select().from(assistants).where(eq(assistants.id, got.conversation.assistantId)))[0]
    : null;
  // messages.parts é jsonb (tipado como unknown pelo Drizzle); o formato
  // gravado é sempre o array de UIMessagePart produzido pelo useChat/onFinish.
  const initialMessages = got.messages.map((m) => ({
    id: m.id,
    role: m.role,
    parts: m.parts,
  })) as unknown as UIMessage[];
  const interruptedMessageIds = got.messages.filter((message) => message.status === "interrupted").map((message) => message.id);
  const integrationNames = (await listUserIntegrations(db, session.user.id))
    .filter((item) => item.connected && (!assistant?.integrationProvider || item.id === assistant.integrationProvider))
    .map((item) => item.name);
  return <Chat conversationId={id} initialMessages={initialMessages} interruptedMessageIds={interruptedMessageIds} assistantName={assistant?.name} integrationNames={integrationNames} />;
}
