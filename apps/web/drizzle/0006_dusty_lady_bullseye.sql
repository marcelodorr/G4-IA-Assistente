CREATE TABLE "integration_activity" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"conversation_id" uuid,
	"provider" text NOT NULL,
	"action" text NOT NULL,
	"request_summary" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"result_content" text,
	"success" boolean NOT NULL,
	"error" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integration_configs" (
	"provider" text PRIMARY KEY NOT NULL,
	"active" boolean DEFAULT false NOT NULL,
	"client_id" text,
	"client_secret_encrypted" text,
	"updated_by" uuid,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integration_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"status" text DEFAULT 'connected' NOT NULL,
	"access_token_encrypted" text NOT NULL,
	"refresh_token_encrypted" text,
	"expires_at" timestamp,
	"scopes" text,
	"external_account_id" text,
	"account_label" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"last_used_at" timestamp,
	"last_error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integration_oauth_states" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"redirect_uri" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_integration_access" (
	"user_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_integration_access_user_id_provider_pk" PRIMARY KEY("user_id","provider")
);
--> statement-breakpoint
ALTER TABLE "corporate_memories" ADD COLUMN "source_type" text DEFAULT 'chat' NOT NULL;--> statement-breakpoint
ALTER TABLE "corporate_memories" ADD COLUMN "source_provider" text;--> statement-breakpoint
ALTER TABLE "integration_activity" ADD CONSTRAINT "integration_activity_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_activity" ADD CONSTRAINT "integration_activity_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_configs" ADD CONSTRAINT "integration_configs_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_connections" ADD CONSTRAINT "integration_connections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_oauth_states" ADD CONSTRAINT "integration_oauth_states_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_integration_access" ADD CONSTRAINT "user_integration_access_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "integration_activity_user_created_idx" ON "integration_activity" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "integration_activity_provider_created_idx" ON "integration_activity" USING btree ("provider","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "integration_connections_user_provider_idx" ON "integration_connections" USING btree ("user_id","provider");--> statement-breakpoint
CREATE INDEX "integration_connections_status_idx" ON "integration_connections" USING btree ("status");--> statement-breakpoint
CREATE INDEX "integration_oauth_states_expires_idx" ON "integration_oauth_states" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "user_integration_access_user_idx" ON "user_integration_access" USING btree ("user_id");