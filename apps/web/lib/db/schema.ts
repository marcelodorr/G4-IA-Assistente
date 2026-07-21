import { pgTable, text, timestamp, boolean, integer, jsonb, uuid, vector, index } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role", { enum: ["admin", "member"] }).notNull().default("member"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const invites = pgTable("invites", {
  id: uuid("id").primaryKey().defaultRandom(),
  token: text("token").notNull().unique(),
  email: text("email").notNull(),
  role: text("role", { enum: ["admin", "member"] }).notNull().default("member"),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const settings = pgTable("settings", {
  id: integer("id").primaryKey().default(1),
  openaiKeyEncrypted: text("openai_key_encrypted"),
  defaultModel: text("default_model").notNull().default("gpt-5-mini"),
  setupCompleted: boolean("setup_completed").notNull().default(false),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const assistants = pgTable("assistants", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),
  systemPrompt: text("system_prompt").notNull(),
  model: text("model"),
  active: boolean("active").notNull().default(true),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const assistantFiles = pgTable("assistant_files", {
  id: uuid("id").primaryKey().defaultRandom(),
  assistantId: uuid("assistant_id").notNull().references(() => assistants.id, { onDelete: "cascade" }),
  filename: text("filename").notNull(),
  mime: text("mime").notNull(),
  size: integer("size").notNull(),
  storagePath: text("storage_path").notNull(),
  status: text("status", { enum: ["pending", "processing", "ready", "error"] }).notNull().default("pending"),
  error: text("error"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const chunks = pgTable("chunks", {
  id: uuid("id").primaryKey().defaultRandom(),
  fileId: uuid("file_id").notNull().references(() => assistantFiles.id, { onDelete: "cascade" }),
  assistantId: uuid("assistant_id").notNull().references(() => assistants.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  chunkIndex: integer("chunk_index").notNull(),
  embedding: vector("embedding", { dimensions: 1536 }).notNull(),
}, (t) => [
  index("chunks_assistant_idx").on(t.assistantId),
  index("chunks_embedding_idx").using("hnsw", t.embedding.op("vector_cosine_ops")),
]);

export const conversations = pgTable("conversations", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  assistantId: uuid("assistant_id").references(() => assistants.id, { onDelete: "set null" }),
  title: text("title"),
  model: text("model"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const messages = pgTable("messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  conversationId: uuid("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  role: text("role", { enum: ["user", "assistant"] }).notNull(),
  parts: jsonb("parts").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
