import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getOwnProfile } from "@/lib/services/profile";
import { ProfileForm } from "@/components/profile/profile-form";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const session = (await auth())!;
  const profile = await getOwnProfile(db, session.user.id);
  return <main className="h-full overflow-y-auto"><div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6"><div><h1 className="font-heading text-xl font-medium">Meu perfil</h1><p className="text-sm text-muted-foreground">Gerencie como você aparece e as informações básicas usadas pela IA.</p></div><ProfileForm profile={profile} /></div></main>;
}
