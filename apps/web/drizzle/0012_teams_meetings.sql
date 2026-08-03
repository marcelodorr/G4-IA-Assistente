ALTER TABLE "users" ADD COLUMN "meetings_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE TABLE "meetings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"assistant_id" uuid,
	"external_event_id" text,
	"external_meeting_id" text,
	"title" text NOT NULL,
	"join_url" text,
	"starts_at" timestamp NOT NULL,
	"ends_at" timestamp NOT NULL,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"participants" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"last_insight_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "meeting_transcript_segments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meeting_id" uuid NOT NULL,
	"sequence" integer NOT NULL,
	"speaker" text DEFAULT 'Participante' NOT NULL,
	"text" text NOT NULL,
	"spoken_at" timestamp DEFAULT now() NOT NULL,
	"is_final" boolean DEFAULT true NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "meeting_insights" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meeting_id" uuid NOT NULL,
	"assistant_id" uuid,
	"kind" text DEFAULT 'suggestion' NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"based_on_sequence" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_assistant_id_assistants_id_fk" FOREIGN KEY ("assistant_id") REFERENCES "public"."assistants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_transcript_segments" ADD CONSTRAINT "meeting_transcript_segments_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_insights" ADD CONSTRAINT "meeting_insights_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_insights" ADD CONSTRAINT "meeting_insights_assistant_id_assistants_id_fk" FOREIGN KEY ("assistant_id") REFERENCES "public"."assistants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "meetings_user_external_event_idx" ON "meetings" USING btree ("user_id","external_event_id");--> statement-breakpoint
CREATE INDEX "meetings_user_starts_idx" ON "meetings" USING btree ("user_id","starts_at");--> statement-breakpoint
CREATE INDEX "meetings_user_status_idx" ON "meetings" USING btree ("user_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "meeting_transcript_sequence_idx" ON "meeting_transcript_segments" USING btree ("meeting_id","sequence");--> statement-breakpoint
CREATE INDEX "meeting_transcript_meeting_created_idx" ON "meeting_transcript_segments" USING btree ("meeting_id","created_at");--> statement-breakpoint
CREATE INDEX "meeting_insights_meeting_created_idx" ON "meeting_insights" USING btree ("meeting_id","created_at");
