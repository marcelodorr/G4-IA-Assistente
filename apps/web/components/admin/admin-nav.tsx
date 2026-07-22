"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ABAS = [
  { href: "/admin/usuarios", label: "Usuários" },
  { href: "/admin/assistentes", label: "Assistentes" },
  { href: "/admin/uso", label: "Uso de IA" },
  { href: "/admin/configuracoes", label: "Configurações" },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-6 border-b px-6">
      {ABAS.map((aba) => {
        const ativo = pathname.startsWith(aba.href);
        return (
          <Link
            key={aba.href}
            href={aba.href}
            className={cn(
              "border-b-2 py-3 text-sm font-medium transition-colors",
              ativo
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {aba.label}
          </Link>
        );
      })}
    </nav>
  );
}
