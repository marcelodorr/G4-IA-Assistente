"use client";
import { useState } from "react";
import Link from "next/link";
import type { Session } from "next-auth";
import { FolderKanban, Menu, MessageSquarePlus, Video } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { ConversationList } from "@/components/sidebar/conversation-list";
import type { listConversations } from "@/lib/services/conversations";
import type { listProjects } from "@/lib/services/projects";
import type { getUserUsageSummary } from "@/lib/services/usage";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { NotificationCenter } from "@/components/system/notification-center";

type ConversationRow = Awaited<ReturnType<typeof listConversations>>[number];
type ProjectRow = Awaited<ReturnType<typeof listProjects>>[number];
type Usage = Awaited<ReturnType<typeof getUserUsageSummary>>;
type Props = { user: Session["user"] & { username?: string | null; avatarUrl?: string | null; meetingsEnabled?: boolean }; conversations: ConversationRow[]; projects: ProjectRow[]; usage: Usage | null; systemVersion: string };

function Brand({ systemVersion, notifications = false }: { systemVersion: string; notifications?: boolean }) {
  return <div className="flex min-w-0 items-center gap-2"><Logo className="h-6 min-w-0 w-auto" /><span className="shrink-0 rounded-full border bg-secondary/50 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">v{systemVersion}</span>{notifications && <div className="ml-auto"><NotificationCenter /></div>}</div>;
}

function SidebarContent({ user, conversations, projects, usage, systemVersion, live, notifications = false }: Props & { live: boolean; notifications?: boolean }) {
  return <><div className="p-4"><Brand systemVersion={systemVersion} notifications={notifications} /></div><div className="grid grid-cols-[1fr_auto] gap-2 px-3 pb-2"><Button asChild className="justify-start"><Link href="/"><MessageSquarePlus />Novo chat</Link></Button><Button asChild variant="outline" size="icon" title="Gerenciar projetos"><Link href="/projetos" aria-label="Gerenciar projetos"><FolderKanban /></Link></Button></div>{user.meetingsEnabled && <div className="px-3 pb-3"><Button asChild variant="outline" className="w-full justify-start"><Link href="/reunioes"><Video />Reuniões</Link></Button></div>}<ConversationList conversations={conversations} projects={projects} user={user} usage={usage} liveUsage={live} /></>;
}

export function Sidebar(props: Props) {
  const [open, setOpen] = useState(false);

  return <>
    <aside className="hidden w-64 shrink-0 flex-col border-r bg-card md:flex"><SidebarContent {...props} live notifications /></aside>
    <header className="fixed inset-x-0 top-0 z-30 flex h-[calc(3.5rem+env(safe-area-inset-top))] items-center justify-between border-b bg-card px-3 pt-[env(safe-area-inset-top)] md:hidden">
      <Brand systemVersion={props.systemVersion} />
      <div className="flex items-center gap-1"><NotificationCenter />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild><Button type="button" variant="ghost" size="icon" aria-label="Abrir menu" aria-expanded={open} aria-controls="mobile-sidebar"><Menu /></Button></DialogTrigger>
        <DialogContent id="mobile-sidebar" aria-label="Menu principal" className="left-0 top-0 flex h-dvh w-[min(20rem,92vw)] max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none border-r p-0 pt-[env(safe-area-inset-top)] md:hidden" onClickCapture={(event) => { if ((event.target as HTMLElement).closest("a")) setOpen(false); }}>
          <DialogTitle className="sr-only">Menu principal</DialogTitle>
          <DialogDescription className="sr-only">Conversas, administração e conta</DialogDescription>
          <SidebarContent {...props} live={false} />
        </DialogContent>
      </Dialog>
      </div>
    </header>
  </>;
}
