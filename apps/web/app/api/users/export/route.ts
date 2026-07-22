import { db } from "@/lib/db";
import { listUsers } from "@/lib/services/users";
import { apiHandler, requireAdmin } from "@/lib/services/guards";

function csvCell(value: unknown) {
  let text = value == null ? "" : String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export const GET = apiHandler(async () => {
  await requireAdmin();
  const rows = await listUsers(db);
  const header = ["Nome", "E-mail", "Papel", "Status", "Cota diária", "Cota semanal", "Cota mensal", "Modelos", "Acesso a assistentes", "Último acesso", "Criado em"];
  const lines = rows.map((user) => [
    user.name, user.email, user.role, user.active ? "Ativo" : "Inativo", user.dailyTokenLimit, user.weeklyTokenLimit, user.monthlyTokenLimit,
    user.allowedModels?.join("; ") ?? "Todos os habilitados", user.assistantAccessMode === "all" ? "Todos" : `${user.assistantIds.length} selecionado(s)`,
    user.lastLoginAt?.toISOString() ?? "", user.createdAt.toISOString(),
  ]);
  const csv = `\uFEFF${[header, ...lines].map((row) => row.map(csvCell).join(",")).join("\r\n")}`;
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="usuarios-sequor-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
});
