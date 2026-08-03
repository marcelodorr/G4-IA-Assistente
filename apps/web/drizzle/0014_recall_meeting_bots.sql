ALTER TABLE "settings" ADD COLUMN "recall_api_key_encrypted" text;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "recall_webhook_secret_encrypted" text;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "recall_region" text DEFAULT 'us-east-1' NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "recall_bot_name" text DEFAULT 'Sequor Copiloto' NOT NULL;--> statement-breakpoint
ALTER TABLE "meetings" ADD COLUMN "recall_bot_id" text;--> statement-breakpoint
ALTER TABLE "meetings" ADD COLUMN "recall_bot_status" text;--> statement-breakpoint
CREATE UNIQUE INDEX "meetings_recall_bot_idx" ON "meetings" USING btree ("recall_bot_id");
