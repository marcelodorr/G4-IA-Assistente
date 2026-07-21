import { db } from "@/lib/db";
import { getValidInvite } from "@/lib/services/invites";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Logo } from "@/components/brand/logo";
import { AcceptInviteForm } from "@/components/auth/accept-invite-form";

export const dynamic = "force-dynamic";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invite = await getValidInvite(db, token);
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center space-y-3">
          <Logo />
          {invite
            ? <p className="text-sm text-muted-foreground">Criar conta para <b>{invite.email}</b></p>
            : <p className="text-sm text-destructive">Convite inválido ou expirado. Peça um novo ao administrador.</p>}
        </CardHeader>
        {invite && <CardContent><AcceptInviteForm token={token} email={invite.email} /></CardContent>}
      </Card>
    </main>
  );
}
