import { beforeEach, describe, expect, it } from "vitest";
import { getTestDb, truncateAll } from "@/test/helpers/db";
import { users } from "@/lib/db/schema";
import { createProject, getProject, listProjects, updateProject } from "./projects";

describe.skipIf(!process.env.TEST_DATABASE_URL)("projects", () => {
  beforeEach(truncateAll);

  it("mantém projetos isolados por proprietário", async () => {
    const db = await getTestDb();
    const [owner, other] = await db.insert(users).values([
      { name: "Dono", email: "dono-projeto@sequor.com.br", passwordHash: "x" },
      { name: "Outro", email: "outro-projeto@sequor.com.br", passwordHash: "x" },
    ]).returning();
    const project = await createProject(db, { userId: owner.id, name: "MES", context: "Cliente ACME" });
    expect(await getProject(db, project.id, other.id)).toBeNull();
    expect(await listProjects(db, other.id)).toHaveLength(0);
    expect(await updateProject(db, project.id, other.id, { context: "tentativa" })).toBeNull();
    expect((await getProject(db, project.id, owner.id))?.context).toBe("Cliente ACME");
  });
});
