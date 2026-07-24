"use client";

import { Plug, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export type IntegrationOption = { id: string; name: string; managedByCompany?: boolean };
export type SkillOption = { id: string; name: string };
export type ChatControls = { selectedIntegrationIds: string[]; selectedSkillIds: string[] };

function Choice({ checked, title, description, onClick }: { checked: boolean; title: string; description?: string; onClick: () => void }) {
  return <button type="button" role="checkbox" aria-checked={checked} onClick={onClick} className={cn("flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-accent", checked && "border-primary bg-primary/5")}><span className={cn("mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border text-[10px]", checked && "border-primary bg-primary text-primary-foreground")}>{checked ? "✓" : ""}</span><span><span className="block text-sm font-medium">{title}</span>{description && <span className="block text-xs text-muted-foreground">{description}</span>}</span></button>;
}

export function ChatCapabilitySelectors({ integrations, skills, controls, onChange, defaultIntegrationId }: { integrations: IntegrationOption[]; skills: SkillOption[]; controls: ChatControls; onChange: (value: ChatControls) => void; defaultIntegrationId?: string | null }) {
  const toggle = (key: keyof ChatControls, id: string) => onChange({ ...controls, [key]: controls[key].includes(id) ? controls[key].filter((value) => value !== id) : [...controls[key], id] });
  return <div className="mb-2 flex max-w-full gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0">
    {integrations.length > 0 && <Dialog><DialogTrigger asChild><Button className="h-9 sm:h-7" type="button" size="sm" variant={controls.selectedIntegrationIds.length ? "default" : "outline"}><Plug />Integrações{controls.selectedIntegrationIds.length ? ` (${controls.selectedIntegrationIds.length})` : " · Automático"}</Button></DialogTrigger><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>Integrações desta resposta</DialogTitle><DialogDescription>Selecione uma ou mais plataformas. Se deixar em automático, o assistente decide qual usar.</DialogDescription></DialogHeader><div className="max-h-[55vh] space-y-2 overflow-y-auto"><Choice checked={controls.selectedIntegrationIds.length === 0} title="Automático" description={defaultIntegrationId ? `O assistente priorizará ${integrations.find((item) => item.id === defaultIntegrationId)?.name ?? "a integração padrão"}.` : "O agente escolhe entre as integrações conectadas."} onClick={() => onChange({ ...controls, selectedIntegrationIds: [] })} />{integrations.map((item) => <Choice key={item.id} checked={controls.selectedIntegrationIds.includes(item.id)} title={item.name} description={item.managedByCompany ? "Conexão universal da empresa" : "Sua conexão individual"} onClick={() => toggle("selectedIntegrationIds", item.id)} />)}</div><DialogFooter showCloseButton /></DialogContent></Dialog>}
    {skills.length > 0 && <Dialog><DialogTrigger asChild><Button className="h-9 sm:h-7" type="button" size="sm" variant={controls.selectedSkillIds.length ? "default" : "outline"}><Sparkles />Skills{controls.selectedSkillIds.length ? ` (${controls.selectedSkillIds.length})` : " · Automático"}</Button></DialogTrigger><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>Acionar skills do projeto</DialogTitle><DialogDescription>Marque as instruções especializadas que devem orientar esta resposta.</DialogDescription></DialogHeader><div className="max-h-[55vh] space-y-2 overflow-y-auto"><Choice checked={controls.selectedSkillIds.length === 0} title="Automático" description="Todas as skills do projeto ficam disponíveis quando forem relevantes." onClick={() => onChange({ ...controls, selectedSkillIds: [] })} />{skills.map((item) => <Choice key={item.id} checked={controls.selectedSkillIds.includes(item.id)} title={item.name} description="Skill privada deste projeto" onClick={() => toggle("selectedSkillIds", item.id)} />)}</div><DialogFooter showCloseButton /></DialogContent></Dialog>}
  </div>;
}
