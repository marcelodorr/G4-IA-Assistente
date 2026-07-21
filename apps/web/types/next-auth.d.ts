import "next-auth";

declare module "next-auth" {
  interface Session {
    user: { id: string; name: string; email: string; role: "admin" | "member" };
  }
  interface User { role: "admin" | "member" }
}
