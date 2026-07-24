"use client";

import { useEffect } from "react";

export function reportClientError(error: unknown) {
  const value = error instanceof Error ? error : new Error(String(error ?? "Erro inesperado"));
  void fetch("/api/notifications", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: value.message, stack: value.stack, path: window.location.pathname }),
  }).then((response) => {
    if (response.ok) window.dispatchEvent(new Event("sequor:notification-created"));
  }).catch(() => null);
}

export function ErrorReporter() {
  useEffect(() => {
    const onError = (event: ErrorEvent) => reportClientError(event.error ?? event.message);
    const onRejection = (event: PromiseRejectionEvent) => reportClientError(event.reason);
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  return null;
}
