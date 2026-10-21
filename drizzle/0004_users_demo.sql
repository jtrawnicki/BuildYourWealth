ALTER TABLE "users" ADD COLUMN "demo_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "demo_ip_hash" text;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_demo_ip_hash_check" CHECK ("users"."demo_ip_hash" is null or "users"."demo_expires_at" is not null);