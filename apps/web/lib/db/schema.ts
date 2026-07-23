import { pgTable, text, timestamp, boolean, integer, jsonb, uuid, vector, index, uniqueIndex, primaryKey } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role", { enum: ["admin", "member"] }).notNull().default("member"),
  active: boolean("active").notNull().default(true),
  dailyTokenLimit: integer("daily_token_limit"),
  weeklyTokenLimit: integer("weekly_token_limit"),
  monthlyTokenLimit: integer("monthly_token_limit"),
  allowedModels: jsonb("allowed_models"),
  assistantAccessMode: text("assistant_access_mode", { enum: ["all", "selected"] }).notNull().default("all"),
  sessionVersion: integer("session_version").notNull().default(1),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const invites = pgTable("invites", {
  id: uuid("id").primaryKey().defaultRandom(),
  token: text("token").notNull().unique(),
  email: text("email").notNull(),
  role: text("role", { enum: ["admin", "member"] }).notNull().default("member"),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  revokedAt: timestamp("revoked_at"),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const settings = pgTable("settings", {
  id: integer("id").primaryKey().default(1),
  openaiKeyEncrypted: text("openai_key_encrypted"),
  defaultModel: text("default_model").notNull().default("gpt-5-mini"),
  setupCompleted: boolean("setup_completed").notNull().default(false),
  dailyTokenLimit: integer("daily_token_limit").notNull().default(200000),
  weeklyTokenLimit: integer("weekly_token_limit").notNull().default(1000000),
  monthlyTokenLimit: integer("monthly_token_limit").notNull().default(4000000),
  maxOutputTokens: integer("max_output_tokens").notNull().default(2048),
  disabledModels: jsonb("disabled_models").notNull().default([]),
  globalContext: text("global_context").notNull().default(""),
  autoLearnEnabled: boolean("auto_learn_enabled").notNull().default(true),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const assistants = pgTable("assistants", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),
  systemPrompt: text("system_prompt").notNull(),
  model: text("model"),
  agentType: text("agent_type", { enum: ["chat", "image", "budget", "presentation", "document"] }).notNull().default("chat"),
  integrationProvider: text("integration_provider", { enum: ["google_calendar", "hubspot", "pipedrive", "apify", "jira", "gitbook"] }),
  active: boolean("active").notNull().default(true),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const userAssistantAccess = pgTable("user_assistant_access", {
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  assistantId: uuid("assistant_id").notNull().references(() => assistants.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  primaryKey({ columns: [t.userId, t.assistantId] }),
  index("user_assistant_access_user_idx").on(t.userId),
]);

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  context: text("context").notNull().default(""),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [index("projects_user_updated_idx").on(t.userId, t.updatedAt)]);

export const projectFiles = pgTable("project_files", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  filename: text("filename").notNull(),
  mime: text("mime").notNull(),
  size: integer("size").notNull(),
  storagePath: text("storage_path").notNull(),
  kind: text("kind", { enum: ["document", "context", "skill"] }).notNull().default("document"),
  status: text("status", { enum: ["pending", "processing", "ready", "error"] }).notNull().default("pending"),
  error: text("error"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [index("project_files_project_idx").on(t.projectId)]);

export const projectChunks = pgTable("project_chunks", {
  id: uuid("id").primaryKey().defaultRandom(),
  fileId: uuid("file_id").notNull().references(() => projectFiles.id, { onDelete: "cascade" }),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  chunkIndex: integer("chunk_index").notNull(),
  embedding: vector("embedding", { dimensions: 1536 }).notNull(),
}, (t) => [
  index("project_chunks_project_idx").on(t.projectId),
  index("project_chunks_embedding_idx").using("hnsw", t.embedding.op("vector_cosine_ops")),
]);

export const integrationConfigs = pgTable("integration_configs", {
  provider: text("provider", { enum: ["google_calendar", "hubspot", "pipedrive", "apify", "jira", "gitbook"] }).primaryKey(),
  active: boolean("active").notNull().default(false),
  clientId: text("client_id"),
  clientSecretEncrypted: text("client_secret_encrypted"),
  updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const userIntegrationAccess = pgTable("user_integration_access", {
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  provider: text("provider", { enum: ["google_calendar", "hubspot", "pipedrive", "apify", "jira", "gitbook"] }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  primaryKey({ columns: [t.userId, t.provider] }),
  index("user_integration_access_user_idx").on(t.userId),
]);

export const integrationConnections = pgTable("integration_connections", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  provider: text("provider", { enum: ["google_calendar", "hubspot", "pipedrive", "apify", "jira", "gitbook"] }).notNull(),
  status: text("status", { enum: ["connected", "error", "revoked"] }).notNull().default("connected"),
  accessTokenEncrypted: text("access_token_encrypted").notNull(),
  refreshTokenEncrypted: text("refresh_token_encrypted"),
  expiresAt: timestamp("expires_at"),
  scopes: text("scopes"),
  externalAccountId: text("external_account_id"),
  accountLabel: text("account_label"),
  metadata: jsonb("metadata").notNull().default({}),
  lastUsedAt: timestamp("last_used_at"),
  lastError: text("last_error"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  uniqueIndex("integration_connections_user_provider_idx").on(t.userId, t.provider),
  index("integration_connections_status_idx").on(t.status),
]);

export const integrationOauthStates = pgTable("integration_oauth_states", {
  tokenHash: text("token_hash").primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  provider: text("provider", { enum: ["google_calendar", "hubspot", "pipedrive", "jira"] }).notNull(),
  redirectUri: text("redirect_uri").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [index("integration_oauth_states_expires_idx").on(t.expiresAt)]);

export const integrationActivity = pgTable("integration_activity", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  conversationId: uuid("conversation_id").references(() => conversations.id, { onDelete: "set null" }),
  provider: text("provider", { enum: ["google_calendar", "hubspot", "pipedrive", "apify", "jira", "gitbook"] }).notNull(),
  action: text("action").notNull(),
  requestSummary: jsonb("request_summary").notNull().default({}),
  resultContent: text("result_content"),
  success: boolean("success").notNull(),
  error: text("error"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("integration_activity_user_created_idx").on(t.userId, t.createdAt),
  index("integration_activity_provider_created_idx").on(t.provider, t.createdAt),
]);

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

export const globalContextFiles = pgTable("global_context_files", {
  id: uuid("id").primaryKey().defaultRandom(),
  filename: text("filename").notNull(),
  mime: text("mime").notNull(),
  size: integer("size").notNull(),
  storagePath: text("storage_path").notNull(),
  status: text("status", { enum: ["pending", "processing", "ready", "error"] }).notNull().default("pending"),
  error: text("error"),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  sourceType: text("source_type", { enum: ["admin", "chat_upload"] }).notNull().default("admin"),
  sourceUserId: uuid("source_user_id").references(() => users.id, { onDelete: "set null" }),
  sourceConversationId: uuid("source_conversation_id"),
  sourceUploadId: uuid("source_upload_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [uniqueIndex("global_context_files_source_upload_idx").on(t.sourceUploadId)]);

export const globalContextChunks = pgTable("global_context_chunks", {
  id: uuid("id").primaryKey().defaultRandom(),
  fileId: uuid("file_id").notNull().references(() => globalContextFiles.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  chunkIndex: integer("chunk_index").notNull(),
  embedding: vector("embedding", { dimensions: 1536 }).notNull(),
}, (t) => [
  index("global_context_chunks_file_idx").on(t.fileId),
  index("global_context_chunks_embedding_idx").using("hnsw", t.embedding.op("vector_cosine_ops")),
]);

export const conversations = pgTable("conversations", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  assistantId: uuid("assistant_id").references(() => assistants.id, { onDelete: "set null" }),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
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
  clientId: text("client_id"),
  status: text("status", { enum: ["streaming", "completed", "interrupted"] }).notNull().default("completed"),
  error: text("error"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  index("messages_conversation_created_idx").on(t.conversationId, t.createdAt),
  uniqueIndex("messages_conversation_client_idx").on(t.conversationId, t.clientId),
]);

export const chatUploads = pgTable("chat_uploads", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  storedName: text("stored_name").notNull().unique(),
  filename: text("filename").notNull(),
  mime: text("mime").notNull(),
  size: integer("size").notNull(),
  conversationId: uuid("conversation_id").references(() => conversations.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [index("chat_uploads_user_idx").on(t.userId)]);

export const corporateMemories = pgTable("corporate_memories", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  conversationId: uuid("conversation_id").references(() => conversations.id, { onDelete: "set null" }),
  messageId: uuid("message_id").references(() => messages.id, { onDelete: "set null" }).unique(),
  content: text("content").notNull(),
  sourceType: text("source_type", { enum: ["chat", "integration"] }).notNull().default("chat"),
  sourceProvider: text("source_provider"),
  status: text("status", { enum: ["pending", "processing", "ready", "error"] }).notNull().default("pending"),
  error: text("error"),
  embedding: vector("embedding", { dimensions: 1536 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("corporate_memories_status_idx").on(t.status),
  index("corporate_memories_embedding_idx").using("hnsw", t.embedding.op("vector_cosine_ops")),
]);

export const artifacts = pgTable("artifacts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  conversationId: uuid("conversation_id").references(() => conversations.id, { onDelete: "set null" }),
  assistantId: uuid("assistant_id").references(() => assistants.id, { onDelete: "set null" }),
  kind: text("kind", { enum: ["image", "spreadsheet", "document", "presentation", "pdf"] }).notNull(),
  filename: text("filename").notNull(),
  mime: text("mime").notNull(),
  size: integer("size").notNull(),
  storagePath: text("storage_path").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("artifacts_user_created_idx").on(t.userId, t.createdAt),
  index("artifacts_conversation_idx").on(t.conversationId),
]);

export const artifactJobs = pgTable("artifact_jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  conversationId: uuid("conversation_id").references(() => conversations.id, { onDelete: "set null" }),
  assistantId: uuid("assistant_id").references(() => assistants.id, { onDelete: "set null" }),
  kind: text("kind", { enum: ["image"] }).notNull().default("image"),
  status: text("status", { enum: ["pending", "processing", "ready", "error"] }).notNull().default("pending"),
  prompt: text("prompt").notNull(),
  options: jsonb("options").notNull().default({}),
  artifactId: uuid("artifact_id").references(() => artifacts.id, { onDelete: "set null" }),
  error: text("error"),
  startedAt: timestamp("started_at"),
  finishedAt: timestamp("finished_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("artifact_jobs_user_created_idx").on(t.userId, t.createdAt),
  index("artifact_jobs_status_idx").on(t.status),
]);

export const aiUsage = pgTable("ai_usage", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  conversationId: uuid("conversation_id").references(() => conversations.id, { onDelete: "set null" }),
  messageId: uuid("message_id").references(() => messages.id, { onDelete: "set null" }),
  kind: text("kind", { enum: ["chat", "embedding", "image", "artifact"] }).notNull(),
  model: text("model").notNull(),
  inputTokens: integer("input_tokens").notNull().default(0),
  outputTokens: integer("output_tokens").notNull().default(0),
  reservedTokens: integer("reserved_tokens").notNull().default(0),
  estimatedCostMicros: integer("estimated_cost_micros").notNull().default(0),
  durationMs: integer("duration_ms"),
  success: boolean("success"),
  error: text("error"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  finishedAt: timestamp("finished_at"),
}, (t) => [
  index("ai_usage_user_created_idx").on(t.userId, t.createdAt),
  index("ai_usage_conversation_idx").on(t.conversationId),
  index("ai_usage_created_idx").on(t.createdAt),
]);
