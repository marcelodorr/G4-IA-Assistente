CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint
CREATE TABLE "assistant_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assistant_id" uuid NOT NULL,
	"filename" text NOT NULL,
	"mime" text NOT NULL,
	"size" integer NOT NULL,
	"storage_path" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"error" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assistants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"system_prompt" text NOT NULL,
	"model" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"file_id" uuid NOT NULL,
	"assistant_id" uuid NOT NULL,
	"content" text NOT NULL,
	"chunk_index" integer NOT NULL,
	"embedding" vector(1536) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"assistant_id" uuid,
	"title" text,
	"model" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token" text NOT NULL,
	"email" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "invites_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"role" text NOT NULL,
	"parts" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"openai_key_encrypted" text,
	"default_model" text DEFAULT 'gpt-5-mini' NOT NULL,
	"setup_completed" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "assistant_files" ADD CONSTRAINT "assistant_files_assistant_id_assistants_id_fk" FOREIGN KEY ("assistant_id") REFERENCES "public"."assistants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assistants" ADD CONSTRAINT "assistants_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chunks" ADD CONSTRAINT "chunks_file_id_assistant_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."assistant_files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chunks" ADD CONSTRAINT "chunks_assistant_id_assistants_id_fk" FOREIGN KEY ("assistant_id") REFERENCES "public"."assistants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_assistant_id_assistants_id_fk" FOREIGN KEY ("assistant_id") REFERENCES "public"."assistants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chunks_assistant_idx" ON "chunks" USING btree ("assistant_id");--> statement-breakpoint
CREATE INDEX "chunks_embedding_idx" ON "chunks" USING hnsw ("embedding" vector_cosine_ops);