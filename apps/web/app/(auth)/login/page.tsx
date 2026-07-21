import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Logo } from "@/components/brand/logo";
import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center space-y-4">
          <Logo />
          <p className="font-serif italic text-muted-foreground">Para quem quer mais</p>
        </CardHeader>
        <CardContent><LoginForm /></CardContent>
      </Card>
    </main>
  );
}
