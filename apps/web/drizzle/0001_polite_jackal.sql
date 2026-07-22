CREATE TABLE "ai_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"conversation_id" uuid,
	"message_id" uuid,
	"kind" text NOT NULL,
	"model" text NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"reserved_tokens" integer DEFAULT 0 NOT NULL,
	"estimated_cost_micros" integer DEFAULT 0 NOT NULL,
	"duration_ms" integer,
	"success" boolean,
	"error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"finished_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "chat_uploads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"stored_name" text NOT NULL,
	"filename" text NOT NULL,
	"mime" text NOT NULL,
	"size" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "chat_uploads_stored_name_unique" UNIQUE("stored_name")
);
--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "client_id" text;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "status" text DEFAULT 'completed' NOT NULL;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "error" text;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "daily_token_limit" integer DEFAULT 200000 NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "monthly_token_limit" integer DEFAULT 4000000 NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "max_output_tokens" integer DEFAULT 2048 NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "disabled_models" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "daily_token_limit" integer;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "monthly_token_limit" integer;--> statement-breakpoint
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_uploads" ADD CONSTRAINT "chat_uploads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_usage_user_created_idx" ON "ai_usage" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "ai_usage_conversation_idx" ON "ai_usage" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "ai_usage_created_idx" ON "ai_usage" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "chat_uploads_user_idx" ON "chat_uploads" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "messages_conversation_created_idx" ON "messages" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "messages_conversation_client_idx" ON "messages" USING btree ("conversation_id","client_id");--> statement-breakpoint
INSERT INTO "chat_uploads" ("user_id", "stored_name", "filename", "mime", "size", "created_at")
SELECT DISTINCT ON (c."user_id", part->>'url')
  c."user_id",
  substring(part->>'url' from length('/api/files/') + 1),
  coalesce(nullif(part->>'filename', ''), 'arquivo'),
  coalesce(nullif(part->>'mediaType', ''), 'application/octet-stream'),
  0,
  m."created_at"
FROM "messages" m
JOIN "conversations" c ON c."id" = m."conversation_id"
CROSS JOIN LATERAL jsonb_array_elements(m."parts") AS part
WHERE m."role" = 'user'
  AND part->>'type' = 'file'
  AND part->>'url' LIKE '/api/files/%'
ON CONFLICT ("stored_name") DO NOTHING;
