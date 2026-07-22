"use client";

import { useCallback, useEffect, useState } from "react";

type JobState = {
  status: "pending" | "processing" | "ready" | "error";
  stale?: boolean;
  error?: string | null;
  filename?: string | null;
  downloadUrl?: string | null;
};

export function ArtifactJobChip({ statusUrl }: { statusUrl: string }) {
  const [job, setJob] = useState<JobState>({ status: "pending" });
  const [retrying, setRetrying] = useState(false);

  const refresh = useCallback(async () => {
    const response = await fetch(statusUrl, { cache: "no-store" });
    if (!response.ok) throw new Error("Não foi possível consultar a geração");
    setJob(await response.json() as JobState);
  }, [statusUrl]);

  useEffect(() => {
    let active = true;
    const poll = async () => {
      try { if (active) await refresh(); } catch { /* a próxima consulta tenta novamente */ }
    };
    void poll();
    const timer = window.setInterval(() => {
      if (job.status !== "ready" && job.status !== "error") void poll();
    }, 3_000);
    return () => { active = false; window.clearInterval(timer); };
  }, [job.status, refresh]);

  const retry = async () => {
    setRetrying(true);
    try {
      const response = await fetch(statusUrl, { method: "POST" });
      if (!response.ok) throw new Error();
      setJob({ status: "pending" });
    } finally {
      setRetrying(false);
    }
  };

  if (job.status === "ready" && job.downloadUrl) {
    return <a className="mb-2 inline-flex w-fit items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary hover:underline" href={job.downloadUrl}>↓ Baixar {job.filename ?? "imagem gerada"}</a>;
  }

  if (job.status === "error" || job.stale) {
    return (
      <div className="mb-2 flex w-fit max-w-xl items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
        <span>{job.error ?? "A geração demorou além do esperado."}</span>
        <button type="button" className="font-semibold underline disabled:opacity-50" disabled={retrying} onClick={() => void retry()}>{retrying ? "Reiniciando…" : "Tentar novamente"}</button>
      </div>
    );
  }

  return <div className="mb-2 inline-flex w-fit items-center gap-1.5 rounded-full bg-secondary/60 px-3 py-1 text-xs text-muted-foreground"><span className="size-1.5 animate-pulse rounded-full bg-primary" />Gerando imagem em segundo plano…</div>;
}
