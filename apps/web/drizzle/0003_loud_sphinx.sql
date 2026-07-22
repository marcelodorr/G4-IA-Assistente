CREATE TABLE "global_context_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"file_id" uuid NOT NULL,
	"content" text NOT NULL,
	"chunk_index" integer NOT NULL,
	"embedding" vector(1536) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "global_context_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"filename" text NOT NULL,
	"mime" text NOT NULL,
	"size" integer NOT NULL,
	"storage_path" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"error" text,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_assistant_access" (
	"user_id" uuid NOT NULL,
	"assistant_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_assistant_access_user_id_assistant_id_pk" PRIMARY KEY("user_id","assistant_id")
);
--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "weekly_token_limit" integer DEFAULT 1000000 NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "global_context" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "weekly_token_limit" integer;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "allowed_models" jsonb;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "assistant_access_mode" text DEFAULT 'all' NOT NULL;--> statement-breakpoint
ALTER TABLE "global_context_chunks" ADD CONSTRAINT "global_context_chunks_file_id_global_context_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."global_context_files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "global_context_files" ADD CONSTRAINT "global_context_files_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_assistant_access" ADD CONSTRAINT "user_assistant_access_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_assistant_access" ADD CONSTRAINT "user_assistant_access_assistant_id_assistants_id_fk" FOREIGN KEY ("assistant_id") REFERENCES "public"."assistants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "global_context_chunks_file_idx" ON "global_context_chunks" USING btree ("file_id");--> statement-breakpoint
CREATE INDEX "global_context_chunks_embedding_idx" ON "global_context_chunks" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "user_assistant_access_user_idx" ON "user_assistant_access" USING btree ("user_id");