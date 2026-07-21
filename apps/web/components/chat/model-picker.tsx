"use client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SUPPORTED_MODELS } from "@/lib/ai/models";

export function ModelPicker({ value, onChange }: { value: string; onChange: (model: string) => void }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-full" aria-label="Modelo">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {SUPPORTED_MODELS.map((m) => (
          <SelectItem key={m} value={m}>
            {m}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
