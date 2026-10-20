CREATE TABLE "login_attempts" (
	"email" text PRIMARY KEY NOT NULL,
	"failed_count" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	CONSTRAINT "login_attempts_failed_count_check" CHECK ("login_attempts"."failed_count" >= 0)
);
