CREATE TABLE "system_error_reads" (
	"error_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"read_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "system_error_reads_error_id_user_id_pk" PRIMARY KEY("error_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "system_errors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"source" text NOT NULL,
	"path" text,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"suggestion" text NOT NULL,
	"code" text DEFAULT 'INTERNAL_ERROR' NOT NULL,
	"severity" text DEFAULT 'error' NOT NULL,
	"technical_details" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "system_version" text DEFAULT '0.1.0' NOT NULL;--> statement-breakpoint
ALTER TABLE "system_error_reads" ADD CONSTRAINT "system_error_reads_error_id_system_errors_id_fk" FOREIGN KEY ("error_id") REFERENCES "public"."system_errors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_error_reads" ADD CONSTRAINT "system_error_reads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_errors" ADD CONSTRAINT "system_errors_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "system_error_reads_user_idx" ON "system_error_reads" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "system_errors_user_created_idx" ON "system_errors" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "system_errors_created_idx" ON "system_errors" USING btree ("created_at");