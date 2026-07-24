"use client";
import { useState } from "react";
import Link from "next/link";
import type { Session } from "next-auth";
import { Menu } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { ConversationList } from "@/components/sidebar/conversation-list";
import type { listConversations } from "@/lib/services/conversations";
import type { listProjects } from "@/lib/services/projects";
import type { getUserUsageSummary } from "@/lib/services/usage";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

type ConversationRow = Awaited<ReturnType<typeof listConversations>>[number];
type ProjectRow = Awaited<ReturnType<typeof listProjects>>[number];
type Usage = Awaited<ReturnType<typeof getUserUsageSummary>>;
type Props = { user: Session["user"]; conversations: ConversationRow[]; projects: ProjectRow[]; usage: Usage };

function SidebarContent({ user, conversations, projects, usage, live }: Props & { live: boolean }) {
  return <><div className="p-4"><Logo className="h-6 w-auto" /></div><div className="space-y-2 px-3 pb-2"><Button asChild className="w-full"><Link href="/">Nova conversa</Link></Button><Button asChild variant="outline" className="w-full"><Link href="/projetos">Projetos</Link></Button></div><ConversationList conversations={conversations} projects={projects} user={user} usage={usage} liveUsage={live} /></>;
}

export function Sidebar(props: Props) {
  const [open, setOpen] = useState(false);

  return <>
    <aside className="hidden w-64 shrink-0 flex-col border-r bg-card md:flex"><SidebarContent {...props} live /></aside>
    <header className="fixed inset-x-0 top-0 z-30 flex h-14 items-center justify-between border-b bg-card px-3 md:hidden">
      <Logo className="h-6 w-auto" />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild><Button type="button" variant="ghost" size="icon" aria-label="Abrir menu" aria-expanded={open} aria-controls="mobile-sidebar"><Menu /></Button></DialogTrigger>
        <DialogContent id="mobile-sidebar" aria-label="Menu principal" className="left-0 top-0 flex h-dvh w-[min(20rem,88vw)] max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none border-r p-0 md:hidden" onClickCapture={(event) => { if ((event.target as HTMLElement).closest("a")) setOpen(false); }}>
          <DialogTitle className="sr-only">Menu principal</DialogTitle>
          <DialogDescription className="sr-only">Conversas, administração e conta</DialogDescription>
          <SidebarContent {...props} live={false} />
        </DialogContent>
      </Dialog>
    </header>
  </>;
}
