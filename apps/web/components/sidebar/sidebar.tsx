import Link from "next/link";
import type { Session } from "next-auth";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { ConversationList } from "@/components/sidebar/conversation-list";
import type { listConversations } from "@/lib/services/conversations";

type ConversationRow = Awaited<ReturnType<typeof listConversations>>[number];

export function Sidebar({
  user,
  conversations,
}: {
  user: Session["user"];
  conversations: ConversationRow[];
}) {
  return (
    <aside className="flex w-64 shrink-0 flex-col border-r bg-card">
      <div className="p-4">
        <Logo className="h-6 w-auto" />
      </div>
      <div className="px-3 pb-2">
        <Button asChild className="w-full">
          <Link href="/">Nova conversa</Link>
        </Button>
      </div>
      <ConversationList conversations={conversations} user={user} />
    </aside>
  );
}
