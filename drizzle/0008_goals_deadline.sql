ALTER TABLE "goals" ADD COLUMN "deadline" text;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_deadline_format_check" CHECK ("goals"."deadline" is null or "goals"."deadline" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$');--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_deadline_target_check" CHECK ("goals"."deadline" is null or "goals"."target_amount" is not null);