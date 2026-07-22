"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[admin] Erro inesperado", error);
  }, [error]);

  return (
    <main className="mx-auto max-w-5xl p-6">
      <Card>
        <CardHeader><CardTitle>Não foi possível abrir esta página</CardTitle></CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>O erro foi registrado no servidor. Tente novamente; se persistir, consulte os logs do Dokploy.</p>
          {error.digest ? <p className="font-mono text-xs">Código: {error.digest}</p> : null}
          <Button type="button" onClick={reset}>Tentar novamente</Button>
        </CardContent>
      </Card>
    </main>
  );
}
