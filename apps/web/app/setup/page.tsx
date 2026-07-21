import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { isSetupCompleted } from "@/lib/services/setup";
import { SetupWizard } from "@/components/setup/setup-wizard";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  if (await isSetupCompleted(db)) redirect("/login");
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <SetupWizard />
    </main>
  );
}
