CREATE TABLE "artifact_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"conversation_id" uuid,
	"assistant_id" uuid,
	"kind" text DEFAULT 'image' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"prompt" text NOT NULL,
	"options" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"artifact_id" uuid,
	"error" text,
	"started_at" timestamp,
	"finished_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "artifact_jobs" ADD CONSTRAINT "artifact_jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artifact_jobs" ADD CONSTRAINT "artifact_jobs_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artifact_jobs" ADD CONSTRAINT "artifact_jobs_assistant_id_assistants_id_fk" FOREIGN KEY ("assistant_id") REFERENCES "public"."assistants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artifact_jobs" ADD CONSTRAINT "artifact_jobs_artifact_id_artifacts_id_fk" FOREIGN KEY ("artifact_id") REFERENCES "public"."artifacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "artifact_jobs_user_created_idx" ON "artifact_jobs" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "artifact_jobs_status_idx" ON "artifact_jobs" USING btree ("status");