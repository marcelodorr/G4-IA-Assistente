"use client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { AssistantSummary } from "@/lib/services/assistants";

// Valor sentinela do item "Chat livre" (sem assistente) no <Select>, que exige
// strings não vazias para cada item.
const CHAT_LIVRE = "__livre__";

export function AssistantPicker({
  assistants,
  value,
  onChange,
}: {
  assistants: AssistantSummary[];
  value: string | null;
  onChange: (assistantId: string | null) => void;
}) {
  return (
    <Select
      value={value ?? CHAT_LIVRE}
      onValueChange={(v) => onChange(v === CHAT_LIVRE ? null : v)}
    >
      <SelectTrigger className="w-full" aria-label="Assistente">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={CHAT_LIVRE}>Chat livre</SelectItem>
        {assistants.map((a) => (
          <SelectItem key={a.id} value={a.id}>
            {a.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
