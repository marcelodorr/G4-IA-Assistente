CREATE TABLE "user_preferences" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"tone" text DEFAULT 'balanced' NOT NULL,
	"traits" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"use_headings" boolean DEFAULT true NOT NULL,
	"use_emojis" boolean DEFAULT false NOT NULL,
	"concise_responses" boolean DEFAULT false NOT NULL,
	"suggested_prompts" boolean DEFAULT true NOT NULL,
	"custom_instructions" text DEFAULT '' NOT NULL,
	"about_you" text DEFAULT '' NOT NULL,
	"job_title" text DEFAULT '' NOT NULL,
	"more_about_you" text DEFAULT '' NOT NULL,
	"memory_enabled" boolean DEFAULT true NOT NULL,
	"web_search_enabled" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "username" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "avatar_storage_path" text;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_username_unique" UNIQUE("username");