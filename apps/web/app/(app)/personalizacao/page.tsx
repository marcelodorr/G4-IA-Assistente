import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getOwnProfile } from "@/lib/services/profile";
import { PersonalizationForm } from "@/components/profile/personalization-form";

export const dynamic = "force-dynamic";

export default async function PersonalizationPage() {
  const session = (await auth())!;
  const profile = await getOwnProfile(db, session.user.id);
  return <main className="h-full overflow-y-auto"><div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6"><div><h1 className="font-heading text-xl font-medium">Personalização</h1><p className="text-sm text-muted-foreground">Defina o estilo, o contexto pessoal e os recursos disponíveis para seus agentes.</p></div><PersonalizationForm initial={profile.preferences} /></div></main>;
}
