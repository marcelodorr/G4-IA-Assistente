ALTER TABLE "integration_configs" ADD COLUMN "connection_mode" text DEFAULT 'individual' NOT NULL;--> statement-breakpoint
ALTER TABLE "integration_configs" ADD COLUMN "universal_connection_user_id" uuid;--> statement-breakpoint
ALTER TABLE "integration_oauth_states" ADD COLUMN "connection_mode" text DEFAULT 'individual' NOT NULL;--> statement-breakpoint
ALTER TABLE "integration_configs" ADD CONSTRAINT "integration_configs_universal_connection_user_id_users_id_fk" FOREIGN KEY ("universal_connection_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;