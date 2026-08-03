"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bot, CalendarDays, ExternalLink, Loader2, MessageSquareText, RefreshCw, Send, Sparkles, Video } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type Meeting = { id: string; title: string; joinUrl: string | null; startsAt: string; endsAt: string; status: "scheduled" | "live" | "ended" | "cancelled"; assistantId: string | null; participants: unknown };
type Assistant = { id: string; name: string; description: string | null };
type Segment = { id: string; sequence: number; speaker: string; text: string; spokenAt: string; isFinal: boolean };
type Insight = { id: string; kind: string; title: string; content: string; createdAt: string };
type State = { meeting: Meeting; transcript: Segment[]; insights: Insight[] };

const kindLabels: Record<string, string> = { objection: "Objeção", question: "Pergunta", opportunity: "Oportunidade", risk: "Risco", suggestion: "Sugestão", summary: "Resumo" };

function time(value: string) { return new Date(value).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }); }
function day(value: string) { return new Date(value).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" }); }

export function MeetingsDashboard() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [assistants, setAssistants] = useState<Assistant[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [state, setState] = useState<State | null>(null);
  const [assistantId, setAssistantId] = useState("");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualText, setManualText] = useState("");
  const transcriptEnd = useRef<HTMLDivElement>(null);

  const loadAgenda = useCallback(async (sync = false) => {
    if (sync) setSyncing(true); else setLoading(true);
    const response = await fetch(`/api/meetings${sync ? "?sync=1" : ""}`, { cache: "no-store" });
    const body = await response.json().catch(() => ({}));
    setLoading(false); setSyncing(false);
    if (!response.ok) { setError(body.error ?? "Não foi possível carregar as reuniões"); return; }
    setError(null); setMeetings(body.meetings); setAssistants(body.assistants);
    setSelectedId((current) => current ?? body.meetings.find((item: Meeting) => item.status === "live")?.id ?? body.meetings.find((item: Meeting) => new Date(item.endsAt).getTime() > Date.now())?.id ?? body.meetings[0]?.id ?? null);
  }, []);

  const loadState = useCallback(async (id: string) => {
    const response = await fetch(`/api/meetings/${id}`, { cache: "no-store" });
    if (!response.ok) return;
    const next = await response.json() as State;
    setState(next); setAssistantId(next.meeting.assistantId ?? "");
  }, []);

  useEffect(() => { const kickoff = window.setTimeout(() => void loadAgenda(true), 0); const timer = window.setInterval(() => void loadAgenda(true), 30_000); return () => { window.clearTimeout(kickoff); window.clearInterval(timer); }; }, [loadAgenda]);
  useEffect(() => { if (!selectedId) return; const kickoff = window.setTimeout(() => void loadState(selectedId), 0); const timer = window.setInterval(() => void loadState(selectedId), 2_000); return () => { window.clearTimeout(kickoff); window.clearInterval(timer); }; }, [selectedId, loadState]);
  useEffect(() => { transcriptEnd.current?.scrollIntoView({ behavior: "smooth" }); }, [state?.transcript.length]);

  async function action(name: "start" | "end") {
    if (!selectedId) return;
    const response = await fetch(`/api/meetings/${selectedId}`, { method: "PATCH", body: JSON.stringify({ action: name, assistantId: assistantId || null }) });
    if (!response.ok) return toast.error((await response.json()).error ?? "Não foi possível atualizar a reunião");
    toast.success(name === "start" ? "Acompanhamento iniciado" : "Acompanhamento encerrado");
    await Promise.all([loadState(selectedId), loadAgenda(false)]);
  }

  async function sendTestSegment() {
    if (!selectedId || !manualText.trim()) return;
    const response = await fetch(`/api/meetings/${selectedId}/transcript`, { method: "POST", body: JSON.stringify({ speaker: "Cliente", text: manualText, source: "manual", isFinal: true }) });
    if (!response.ok) return toast.error((await response.json()).error ?? "Falha ao enviar trecho");
    setManualText(""); await loadState(selectedId);
  }

  return <div className="grid min-h-full gap-4 p-4 lg:grid-cols-[19rem_minmax(0,1fr)] sm:p-6">
    <aside className="space-y-3">
      <div className="flex items-center justify-between"><div><h1 className="font-heading text-xl font-medium">Reuniões</h1><p className="text-xs text-muted-foreground">Agenda Microsoft Teams</p></div><Button size="icon" variant="outline" disabled={syncing} onClick={() => void loadAgenda(true)} aria-label="Atualizar agenda">{syncing ? <Loader2 className="animate-spin" /> : <RefreshCw />}</Button></div>
      {error && <Card><CardContent className="space-y-3 p-4 text-sm"><p>{error}</p><Button asChild size="sm"><Link href="/integracoes">Conectar Microsoft Teams</Link></Button></CardContent></Card>}
      <div className="space-y-2">{loading ? <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />Carregando agenda...</div> : meetings.map((meeting) => <button type="button" key={meeting.id} onClick={() => setSelectedId(meeting.id)} className={cn("w-full rounded-xl border p-3 text-left transition hover:bg-accent", selectedId === meeting.id && "border-primary bg-primary/10")}><div className="flex items-center justify-between gap-2"><span className="text-xs text-muted-foreground">{day(meeting.startsAt)}</span><Badge variant={meeting.status === "live" ? "default" : "outline"}>{meeting.status === "live" ? "Ao vivo" : meeting.status === "ended" ? "Encerrada" : meeting.status === "cancelled" ? "Cancelada" : "Agendada"}</Badge></div><p className="mt-2 line-clamp-2 text-sm font-medium">{meeting.title}</p><p className="mt-1 text-xs text-muted-foreground">{time(meeting.startsAt)}–{time(meeting.endsAt)}</p></button>)}{!loading && !error && meetings.length === 0 && <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground"><CalendarDays className="mx-auto mb-2" />Nenhuma reunião do Teams nas próximas duas semanas.</div>}</div>
    </aside>

    <section className="min-w-0">{!state ? <div className="grid h-full min-h-96 place-items-center rounded-xl border border-dashed text-center text-muted-foreground"><div><Video className="mx-auto mb-3 size-10" /><p>Selecione uma reunião para acompanhar.</p></div></div> : <div className="flex h-[calc(100dvh-3rem)] min-h-[38rem] flex-col overflow-hidden rounded-xl border bg-card lg:h-[calc(100dvh-3rem)]">
      <header className="flex flex-col gap-3 border-b p-4 xl:flex-row xl:items-center xl:justify-between"><div className="min-w-0"><div className="flex items-center gap-2"><Badge variant={state.meeting.status === "live" ? "default" : "outline"}>{state.meeting.status === "live" ? "Acompanhando ao vivo" : "Pronta para acompanhar"}</Badge><span className="text-xs text-muted-foreground">{time(state.meeting.startsAt)}–{time(state.meeting.endsAt)}</span></div><h2 className="mt-1 truncate text-lg font-medium">{state.meeting.title}</h2></div><div className="flex flex-wrap items-center gap-2"><Select value={assistantId} onValueChange={setAssistantId} disabled={state.meeting.status === "live"}><SelectTrigger className="w-56"><Bot /><SelectValue placeholder="Escolha um assistente" /></SelectTrigger><SelectContent>{assistants.map((assistant) => <SelectItem key={assistant.id} value={assistant.id}>{assistant.name}</SelectItem>)}</SelectContent></Select>{state.meeting.joinUrl && <Button asChild variant="outline"><a href={state.meeting.joinUrl} target="_blank" rel="noreferrer"><ExternalLink />Entrar no Teams</a></Button>}{state.meeting.status === "live" ? <Button variant="destructive" onClick={() => void action("end")}>Encerrar</Button> : <Button disabled={!assistantId || state.meeting.status === "cancelled"} onClick={() => void action("start")}><Sparkles />Iniciar acompanhamento</Button>}</div></header>
      <div className="grid min-h-0 flex-1 lg:grid-cols-2">
        <div className="flex min-h-0 flex-col border-b lg:border-r lg:border-b-0"><div className="flex items-center gap-2 border-b px-4 py-3 text-sm font-medium"><MessageSquareText className="size-4" />Transcrição em tempo real</div><div className="flex-1 space-y-4 overflow-y-auto p-4">{state.transcript.map((segment) => <div key={segment.id}><div className="mb-1 flex items-center gap-2"><span className="text-xs font-semibold text-primary">{segment.speaker}</span><span className="text-[10px] text-muted-foreground">{time(segment.spokenAt)}</span></div><p className="rounded-xl rounded-tl-sm bg-muted px-3 py-2 text-sm leading-relaxed">{segment.text}</p></div>)}{state.transcript.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">Os trechos recebidos do transcritor aparecerão aqui.</p>}<div ref={transcriptEnd} /></div>{state.meeting.status === "live" && <details className="border-t p-3"><summary className="cursor-pointer text-xs text-muted-foreground">Simular entrada do transcritor</summary><div className="mt-2 flex gap-2"><Textarea value={manualText} onChange={(event) => setManualText(event.target.value)} rows={2} placeholder="Trecho para testar o fluxo enquanto o ElevenLabs não está conectado" /><Button size="icon" onClick={() => void sendTestSegment()}><Send /></Button></div></details>}</div>
        <div className="flex min-h-0 flex-col"><div className="flex items-center gap-2 border-b px-4 py-3 text-sm font-medium"><Sparkles className="size-4 text-primary" />Insights do assistente</div><div className="flex-1 space-y-3 overflow-y-auto p-4">{state.insights.map((insight) => <Card key={insight.id} className="gap-2 py-4"><CardHeader className="px-4"><div className="flex items-center justify-between gap-2"><Badge variant="outline">{kindLabels[insight.kind] ?? insight.kind}</Badge><span className="text-[10px] text-muted-foreground">{time(insight.createdAt)}</span></div><CardTitle className="text-sm">{insight.title}</CardTitle></CardHeader><CardContent className="px-4 text-sm leading-relaxed text-muted-foreground">{insight.content}</CardContent></Card>)}{state.insights.length === 0 && <div className="py-10 text-center text-sm text-muted-foreground"><Sparkles className="mx-auto mb-2" /><p>O assistente analisará objeções, dúvidas e oportunidades conforme a conversa evoluir.</p></div>}</div></div>
      </div>
    </div>}</section>
  </div>;
}
