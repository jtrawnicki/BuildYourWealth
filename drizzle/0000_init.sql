CREATE TABLE "goals" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "goals_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" integer NOT NULL,
	"pool" text NOT NULL,
	"name" text NOT NULL,
	"pct" integer NOT NULL,
	"source_id" integer NOT NULL,
	"target_amount" bigint,
	"start_amount" bigint,
	"position" integer NOT NULL,
	"removed_at" timestamp with time zone,
	CONSTRAINT "goals_pool_valid" CHECK (pool in ('savings', 'investments')),
	CONSTRAINT "goals_name_length" CHECK (char_length(name) between 1 and 60),
	CONSTRAINT "goals_pct_range" CHECK (pct between 1 and 10000),
	CONSTRAINT "goals_target_nonnegative" CHECK (target_amount >= 0),
	CONSTRAINT "goals_start_nonnegative" CHECK (start_amount >= 0)
);
--> statement-breakpoint
CREATE TABLE "incomes" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "incomes_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"month_id" integer NOT NULL,
	"name" text NOT NULL,
	"amount" bigint NOT NULL,
	CONSTRAINT "incomes_name_length" CHECK (char_length(name) between 1 and 60),
	CONSTRAINT "incomes_amount_positive" CHECK (amount > 0)
);
--> statement-breakpoint
CREATE TABLE "month_goals" (
	"month_id" integer NOT NULL,
	"goal_id" integer NOT NULL,
	"pool" text NOT NULL,
	"pct" integer NOT NULL,
	"source_id" integer NOT NULL,
	"actual_amount" bigint,
	CONSTRAINT "month_goals_month_id_goal_id_pk" PRIMARY KEY("month_id","goal_id"),
	CONSTRAINT "month_goals_pool_valid" CHECK (pool in ('savings', 'investments')),
	CONSTRAINT "month_goals_pct_range" CHECK (pct between 1 and 10000),
	CONSTRAINT "month_goals_actual_nonnegative" CHECK (actual_amount >= 0)
);
--> statement-breakpoint
CREATE TABLE "months" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "months_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" integer NOT NULL,
	"month" text NOT NULL,
	"savings_pct" integer NOT NULL,
	"investments_pct" integer NOT NULL,
	"settled_at" timestamp with time zone,
	"settled_eur_rate" integer,
	CONSTRAINT "months_user_month_unique" UNIQUE("user_id","month"),
	CONSTRAINT "months_month_format" CHECK (month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
	CONSTRAINT "months_savings_pct_range" CHECK (savings_pct between 0 and 10000),
	CONSTRAINT "months_investments_pct_range" CHECK (investments_pct between 0 and 10000),
	CONSTRAINT "months_pools_sum" CHECK (savings_pct + investments_pct <= 10000),
	CONSTRAINT "months_settled_eur_rate_positive" CHECK (settled_eur_rate > 0),
	CONSTRAINT "months_rate_only_when_settled" CHECK (settled_eur_rate is null or settled_at is not null)
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"user_id" integer PRIMARY KEY NOT NULL,
	"eur_rate" integer,
	"savings_pct" integer DEFAULT 0 NOT NULL,
	"investments_pct" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "settings_eur_rate_positive" CHECK (eur_rate > 0),
	CONSTRAINT "settings_savings_pct_range" CHECK (savings_pct between 0 and 10000),
	CONSTRAINT "settings_investments_pct_range" CHECK (investments_pct between 0 and 10000),
	CONSTRAINT "settings_pools_sum" CHECK (savings_pct + investments_pct <= 10000)
);
--> statement-breakpoint
CREATE TABLE "sources" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "sources_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" integer NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"currency" text NOT NULL,
	"value" bigint DEFAULT 0 NOT NULL,
	"note" text,
	"archived_at" timestamp with time zone,
	CONSTRAINT "sources_name_length" CHECK (char_length(name) between 1 and 60),
	CONSTRAINT "sources_kind_valid" CHECK (kind in ('savings', 'investments')),
	CONSTRAINT "sources_currency_valid" CHECK (currency in ('PLN', 'EUR')),
	CONSTRAINT "sources_value_nonnegative" CHECK (value >= 0),
	CONSTRAINT "sources_archived_empty" CHECK (archived_at is null or value = 0)
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "users_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_email_normalized" CHECK (email = lower(btrim(email)))
);
--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incomes" ADD CONSTRAINT "incomes_month_id_months_id_fk" FOREIGN KEY ("month_id") REFERENCES "public"."months"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "month_goals" ADD CONSTRAINT "month_goals_month_id_months_id_fk" FOREIGN KEY ("month_id") REFERENCES "public"."months"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "month_goals" ADD CONSTRAINT "month_goals_goal_id_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "month_goals" ADD CONSTRAINT "month_goals_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "months" ADD CONSTRAINT "months_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sources" ADD CONSTRAINT "sources_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;