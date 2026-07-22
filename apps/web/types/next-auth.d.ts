import "next-auth";

declare module "next-auth" {
  interface Session {
    user: { id: string; name: string; email: string; role: "admin" | "member"; sessionVersion: number };
  }
  interface User { role: "admin" | "member"; sessionVersion: number }
}
