"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { reportClientError } from "@/components/system/error-reporter";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[aplicação] Erro inesperado", error);
    reportClientError(error);
  }, [error]);

  return <main className="h-full overflow-y-auto"><div className="mx-auto max-w-xl p-4 sm:p-6"><Card><CardHeader><CardTitle>Esta tela encontrou um problema</CardTitle></CardHeader><CardContent className="space-y-4 text-sm text-muted-foreground"><p>Não foi possível concluir a abertura desta tela. O erro já foi enviado para a central de notificações.</p><p>Tente novamente. Se continuar acontecendo, abra o sino ao lado do logotipo para ver a orientação.</p>{error.digest && <p className="font-mono text-xs">Código: {error.digest}</p>}<Button type="button" onClick={reset}>Tentar novamente</Button></CardContent></Card></div></main>;
}
