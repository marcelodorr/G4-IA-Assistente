"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ABAS = [
  { href: "/admin/usuarios", label: "Usuários" },
  { href: "/admin/assistentes", label: "Assistentes" },
  { href: "/admin/uso", label: "Uso de IA" },
  { href: "/admin/saude", label: "Saúde" },
  { href: "/admin/configuracoes", label: "Configurações" },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Administração" className="flex gap-5 overflow-x-auto border-b px-4 sm:px-6">
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
