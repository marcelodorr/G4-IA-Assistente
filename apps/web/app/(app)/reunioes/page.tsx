import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { MeetingsDashboard } from "@/components/meetings/meetings-dashboard";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export default async function ReunioesPage() {
  const session = await auth();
  const [user] = await db.select({ meetingsEnabled: users.meetingsEnabled }).from(users).where(eq(users.id, session!.user.id)).limit(1);
  if (!user?.meetingsEnabled) redirect("/");
  return <main className="h-full overflow-y-auto"><MeetingsDashboard /></main>;
}
