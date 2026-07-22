CREATE TABLE "artifacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"conversation_id" uuid,
	"assistant_id" uuid,
	"kind" text NOT NULL,
	"filename" text NOT NULL,
	"mime" text NOT NULL,
	"size" integer NOT NULL,
	"storage_path" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "corporate_memories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"conversation_id" uuid,
	"message_id" uuid,
	"content" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"error" text,
	"embedding" vector(1536),
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "corporate_memories_message_id_unique" UNIQUE("message_id")
);
--> statement-breakpoint
ALTER TABLE "assistants" ADD COLUMN "agent_type" text DEFAULT 'chat' NOT NULL;--> statement-breakpoint
ALTER TABLE "chat_uploads" ADD COLUMN "conversation_id" uuid;--> statement-breakpoint
ALTER TABLE "global_context_files" ADD COLUMN "source_type" text DEFAULT 'admin' NOT NULL;--> statement-breakpoint
ALTER TABLE "global_context_files" ADD COLUMN "source_user_id" uuid;--> statement-breakpoint
ALTER TABLE "global_context_files" ADD COLUMN "source_conversation_id" uuid;--> statement-breakpoint
ALTER TABLE "global_context_files" ADD COLUMN "source_upload_id" uuid;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "auto_learn_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_assistant_id_assistants_id_fk" FOREIGN KEY ("assistant_id") REFERENCES "public"."assistants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "corporate_memories" ADD CONSTRAINT "corporate_memories_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "corporate_memories" ADD CONSTRAINT "corporate_memories_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "corporate_memories" ADD CONSTRAINT "corporate_memories_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "artifacts_user_created_idx" ON "artifacts" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "artifacts_conversation_idx" ON "artifacts" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "corporate_memories_status_idx" ON "corporate_memories" USING btree ("status");--> statement-breakpoint
CREATE INDEX "corporate_memories_embedding_idx" ON "corporate_memories" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
ALTER TABLE "chat_uploads" ADD CONSTRAINT "chat_uploads_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "global_context_files" ADD CONSTRAINT "global_context_files_source_user_id_users_id_fk" FOREIGN KEY ("source_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "global_context_files_source_upload_idx" ON "global_context_files" USING btree ("source_upload_id");
