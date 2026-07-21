import { Logo } from "@/components/brand/logo";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4">
      <Logo />
      <p className="text-muted-foreground">G4 IA Assistente — em construção</p>
    </main>
  );
}
