"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { getUserUsageSummary } from "@/lib/services/usage";

type Usage = Awaited<ReturnType<typeof getUserUsageSummary>>;

function formatTokens(value: number) {
  return new Intl.NumberFormat("pt-BR", { notation: value >= 10_000 ? "compact" : "standard", maximumFractionDigits: 1 }).format(value);
}

export function UserUsageWidget({ initialUsage, live = true }: { initialUsage: Usage; live?: boolean }) {
  const [usage, setUsage] = useState(initialUsage);

  const refresh = useCallback(async () => {
    const response = await fetch("/api/usage/me", { cache: "no-store" });
    if (response.ok) setUsage(await response.json() as Usage);
  }, []);

  useEffect(() => {
    if (!live) return;
    const onUsageUpdated = () => void refresh();
    window.addEventListener("sequor:usage-updated", onUsageUpdated);
    const timer = window.setInterval(refresh, 15_000);
    return () => {
      window.removeEventListener("sequor:usage-updated", onUsageUpdated);
      window.clearInterval(timer);
    };
  }, [live, refresh]);

  const latest = usage.interactions[0];
  return (
    <Link href="/uso" className="block rounded-lg border bg-background/60 p-2.5 transition-colors hover:border-primary/50 hover:bg-accent">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="font-medium text-foreground">Meus tokens</span>
        <span className="text-muted-foreground">ver detalhes</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary" aria-label={`${usage.periods.daily.percentage}% da cota diária utilizada`}>
        <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${usage.periods.daily.percentage}%` }} />
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
        <span>Hoje: {formatTokens(usage.periods.daily.used)}</span>
        <span>{formatTokens(usage.periods.daily.remaining)} disponíveis</span>
      </div>
      {latest && (
        <p className="mt-1.5 truncate text-[11px] text-muted-foreground">
          {latest.processing ? "Em andamento: até " : "Última operação: "}{formatTokens(latest.tokens)} tokens
        </p>
      )}
    </Link>
  );
}
