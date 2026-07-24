"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import type { Session } from "next-auth";
import { ChevronDown, ChevronRight, Folder, GripVertical, LogOut, MessageSquare, Plug, Settings2, Shield, Trash2, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { listConversations } from "@/lib/services/conversations";
import type { listProjects } from "@/lib/services/projects";
import type { getUserUsageSummary } from "@/lib/services/usage";
import { UserUsageWidget } from "@/components/usage/user-usage-widget";

type ConversationRow = Awaited<ReturnType<typeof listConversations>>[number];
type ProjectRow = Awaited<ReturnType<typeof listProjects>>[number];
type Usage = Awaited<ReturnType<typeof getUserUsageSummary>>;
type SidebarUser = Session["user"] & { username?: string | null; avatarUrl?: string | null };

export function ConversationList({ conversations, projects, user, usage, liveUsage }: { conversations: ConversationRow[]; projects: ProjectRow[]; user: SidebarUser; usage: Usage | null; liveUsage: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [deleteConversation, setDeleteConversation] = useState<ConversationRow | null>(null);
  const [deleteProject, setDeleteProject] = useState<ProjectRow | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const filtered = conversations.filter((conversation) => (conversation.title ?? "Nova conversa").toLowerCase().includes(search.toLowerCase()));

  function toggleProject(id: string) {
    setCollapsed((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }

  async function moveConversation(projectId: string | null) {
    if (!draggingId) return;
    const conversation = conversations.find((item) => item.id === draggingId);
    setDropTarget(null); setDraggingId(null);
    if (!conversation || conversation.projectId === projectId) return;
    setBusy(conversation.id);
    const response = await fetch(`/api/conversations/${conversation.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectId }) });
    setBusy(null);
    if (!response.ok) return toast.error((await response.json().catch(() => ({}))).error ?? "Não foi possível mover o chat");
    toast.success(projectId ? "Chat movido para o projeto" : "Chat movido para conversas avulsas");
    router.refresh();
  }

  async function confirmDeleteConversation() {
    if (!deleteConversation) return;
    setBusy(deleteConversation.id);
    const response = await fetch(`/api/conversations/${deleteConversation.id}`, { method: "DELETE" });
    setBusy(null);
    if (!response.ok) return toast.error("Não foi possível excluir o chat");
    const wasActive = pathname === `/c/${deleteConversation.id}`;
    setDeleteConversation(null); toast.success("Chat excluído"); router.refresh();
    if (wasActive) router.push("/");
  }

  async function confirmDeleteProject() {
    if (!deleteProject) return;
    setBusy(deleteProject.id);
    const response = await fetch(`/api/projects/${deleteProject.id}`, { method: "DELETE" });
    setBusy(null);
    if (!response.ok) return toast.error("Não foi possível excluir o projeto");
    const wasActive = pathname === `/projetos/${deleteProject.id}`;
    setDeleteProject(null); toast.success("Projeto excluído; os chats foram mantidos como avulsos"); router.refresh();
    if (wasActive) router.push("/projetos");
  }

  async function logout() {
    setSigningOut(true);
    try { await signOut({ redirect: false }); window.location.assign("/login"); } catch { setSigningOut(false); }
  }

  function conversationItem(conversation: ConversationRow) {
    const href = `/c/${conversation.id}`;
    return <div key={conversation.id} draggable onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", conversation.id); setDraggingId(conversation.id); }} onDragEnd={() => { setDraggingId(null); setDropTarget(null); }} className={cn("group/chat relative flex items-center rounded-lg transition", pathname === href ? "bg-primary/12 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground", busy === conversation.id && "opacity-50", draggingId === conversation.id && "opacity-40")}><GripVertical className="ml-1 size-3 shrink-0 cursor-grab opacity-0 group-hover/chat:opacity-50" /><Link href={href} className="min-w-0 flex-1 truncate py-1.5 pl-1 pr-7 text-sm"><MessageSquare className="mr-1.5 inline size-3.5" />{conversation.title || "Nova conversa"}</Link><button type="button" onClick={() => setDeleteConversation(conversation)} aria-label={`Excluir ${conversation.title ?? "chat"}`} className="absolute right-1.5 rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive md:opacity-0 md:group-hover/chat:opacity-100 md:focus:opacity-100"><Trash2 className="size-3.5" /></button></div>;
  }

  const dropProps = (target: string, projectId: string | null) => ({
    onDragOver: (event: React.DragEvent) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; setDropTarget(target); },
    onDragLeave: (event: React.DragEvent) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDropTarget(null); },
    onDrop: (event: React.DragEvent) => { event.preventDefault(); void moveConversation(projectId); },
  });

  const standalone = filtered.filter((conversation) => !conversation.projectId);
  return <div className="flex flex-1 flex-col overflow-hidden">
    <div className="px-3 pb-2"><Input value={search} aria-label="Buscar chats" onChange={(event) => setSearch(event.target.value)} placeholder="Buscar chats..." /></div>
    <nav className="flex-1 overflow-y-auto px-2 pb-2">
      <div className="mb-1 flex items-center justify-between px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"><span className="flex items-center gap-1.5"><Folder className="size-3.5" />Projetos</span><span>{projects.length}</span></div>
      <div className="space-y-1">{projects.map((project) => { const items = filtered.filter((conversation) => conversation.projectId === project.id); const isCollapsed = collapsed.has(project.id); return <section key={project.id} {...dropProps(project.id, project.id)} className={cn("rounded-lg border border-transparent p-1 transition-colors", dropTarget === project.id && "border-primary bg-primary/10")}><div className="group/project flex items-center gap-1"><button type="button" onClick={() => toggleProject(project.id)} className="rounded p-1 text-muted-foreground hover:bg-accent" aria-label={isCollapsed ? `Expandir ${project.name}` : `Recolher ${project.name}`}>{isCollapsed ? <ChevronRight className="size-3.5" /> : <ChevronDown className="size-3.5" />}</button><Link href={`/projetos/${project.id}`} className="min-w-0 flex-1 truncate text-sm font-medium"><Folder className="mr-1.5 inline size-4 text-primary" />{project.name}</Link><span className="text-[10px] text-muted-foreground">{items.length}</span><Link href={`/?project=${project.id}`} className="rounded px-1 text-base leading-none text-muted-foreground hover:text-primary md:opacity-0 md:group-hover/project:opacity-100" aria-label={`Novo chat em ${project.name}`}>+</Link><button type="button" onClick={() => setDeleteProject(project)} className="rounded p-1 text-muted-foreground hover:text-destructive md:opacity-0 md:group-hover/project:opacity-100 md:focus:opacity-100" aria-label={`Excluir projeto ${project.name}`}><Trash2 className="size-3" /></button></div>{!isCollapsed && <div className="mt-1 space-y-0.5 border-l border-border/60 pl-2 ml-2">{items.map(conversationItem)}{items.length === 0 && <p className="px-2 py-2 text-xs text-muted-foreground">Arraste um chat para cá</p>}</div>}</section>; })}</div>
      <section {...dropProps("standalone", null)} className={cn("mt-3 rounded-lg border border-transparent p-1 transition-colors", dropTarget === "standalone" && "border-primary bg-primary/10")}><div className="mb-1 flex items-center justify-between px-1 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"><span className="flex items-center gap-1.5"><MessageSquare className="size-3.5" />Chats avulsos</span><span>{standalone.length}</span></div><div className="space-y-0.5">{standalone.map(conversationItem)}{standalone.length === 0 && <p className="px-2 py-2 text-xs text-muted-foreground">Arraste chats para remover do projeto</p>}</div></section>
      {filtered.length === 0 && search && <p className="p-3 text-center text-sm text-muted-foreground">Nenhum chat encontrado.</p>}
    </nav>
    <div className="space-y-2 border-t p-3"><UserUsageWidget initialUsage={usage} live={liveUsage} /><div className="flex items-center gap-2"><Avatar size="sm"><AvatarImage src={user.avatarUrl ?? undefined} /><AvatarFallback>{user.name?.slice(0, 2).toUpperCase()}</AvatarFallback></Avatar><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{user.name}</p><p className="truncate text-[11px] text-muted-foreground">{user.username ? `@${user.username}` : user.email}</p></div><div className="flex"><Button asChild size="icon-sm" variant="ghost" title="Meu perfil"><Link href="/perfil" aria-label="Meu perfil"><UserRound /></Link></Button><Button asChild size="icon-sm" variant="ghost" title="Personalização"><Link href="/personalizacao" aria-label="Personalização"><Settings2 /></Link></Button><Button asChild size="icon-sm" variant="ghost" title="Integrações"><Link href="/integracoes" aria-label="Integrações"><Plug /></Link></Button>{user.role === "admin" && <Button asChild size="icon-sm" variant="ghost" title="Administração"><Link href="/admin/usuarios" aria-label="Administração"><Shield /></Link></Button>}</div></div><Button variant="outline" size="sm" className="w-full" disabled={signingOut} onClick={() => void logout()}><LogOut />{signingOut ? "Saindo…" : "Sair"}</Button></div>
    <Dialog open={Boolean(deleteConversation)} onOpenChange={(open) => { if (!open) setDeleteConversation(null); }}><DialogContent><DialogHeader><DialogTitle>Excluir este chat?</DialogTitle><DialogDescription>“{deleteConversation?.title ?? "Nova conversa"}” e todo o histórico serão removidos permanentemente.</DialogDescription></DialogHeader><DialogFooter><DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose><Button variant="destructive" disabled={busy === deleteConversation?.id} onClick={() => void confirmDeleteConversation()}>{busy ? "Excluindo…" : "Excluir chat"}</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={Boolean(deleteProject)} onOpenChange={(open) => { if (!open) setDeleteProject(null); }}><DialogContent><DialogHeader><DialogTitle>Excluir o projeto?</DialogTitle><DialogDescription>O contexto, os documentos e as skills de “{deleteProject?.name}” serão removidos. Os chats serão preservados como conversas avulsas.</DialogDescription></DialogHeader><DialogFooter><DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose><Button variant="destructive" disabled={busy === deleteProject?.id} onClick={() => void confirmDeleteProject()}>{busy ? "Excluindo…" : "Excluir projeto"}</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
