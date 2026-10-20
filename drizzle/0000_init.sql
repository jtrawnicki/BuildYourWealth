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
	CONSTRAINT "goals_pool_check" CHECK ("goals"."pool" in ('savings', 'investments')),
	CONSTRAINT "goals_name_check" CHECK (char_length("goals"."name") between 1 and 60),
	CONSTRAINT "goals_pct_check" CHECK ("goals"."pct" > 0 and "goals"."pct" <= 10000),
	CONSTRAINT "goals_target_amount_check" CHECK ("goals"."target_amount" >= 0),
	CONSTRAINT "goals_start_amount_check" CHECK ("goals"."start_amount" >= 0),
	CONSTRAINT "goals_position_check" CHECK ("goals"."position" >= 0)
);
--> statement-breakpoint
CREATE TABLE "incomes" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "incomes_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"month_id" integer NOT NULL,
	"name" text NOT NULL,
	"amount" bigint NOT NULL,
	CONSTRAINT "incomes_name_check" CHECK (char_length("incomes"."name") between 1 and 60),
	CONSTRAINT "incomes_amount_check" CHECK ("incomes"."amount" > 0)
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
	CONSTRAINT "month_goals_pool_check" CHECK ("month_goals"."pool" in ('savings', 'investments')),
	CONSTRAINT "month_goals_pct_check" CHECK ("month_goals"."pct" > 0 and "month_goals"."pct" <= 10000),
	CONSTRAINT "month_goals_actual_amount_check" CHECK ("month_goals"."actual_amount" >= 0)
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
	CONSTRAINT "months_user_id_month_key" UNIQUE("user_id","month"),
	CONSTRAINT "months_month_check" CHECK ("months"."month" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
	CONSTRAINT "months_savings_pct_check" CHECK ("months"."savings_pct" between 0 and 10000),
	CONSTRAINT "months_investments_pct_check" CHECK ("months"."investments_pct" between 0 and 10000),
	CONSTRAINT "months_pools_sum_check" CHECK ("months"."savings_pct" + "months"."investments_pct" <= 10000),
	CONSTRAINT "months_settled_eur_rate_check" CHECK ("months"."settled_eur_rate" > 0),
	CONSTRAINT "months_settled_eur_rate_settled_check" CHECK ("months"."settled_eur_rate" is null or "months"."settled_at" is not null)
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
	CONSTRAINT "settings_eur_rate_check" CHECK ("settings"."eur_rate" > 0),
	CONSTRAINT "settings_savings_pct_check" CHECK ("settings"."savings_pct" between 0 and 10000),
	CONSTRAINT "settings_investments_pct_check" CHECK ("settings"."investments_pct" between 0 and 10000),
	CONSTRAINT "settings_pools_sum_check" CHECK ("settings"."savings_pct" + "settings"."investments_pct" <= 10000)
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
	CONSTRAINT "sources_id_user_id_kind_key" UNIQUE("id","user_id","kind"),
	CONSTRAINT "sources_id_kind_key" UNIQUE("id","kind"),
	CONSTRAINT "sources_name_check" CHECK (char_length("sources"."name") between 1 and 60),
	CONSTRAINT "sources_kind_check" CHECK ("sources"."kind" in ('savings', 'investments')),
	CONSTRAINT "sources_currency_check" CHECK ("sources"."currency" in ('PLN', 'EUR')),
	CONSTRAINT "sources_value_check" CHECK ("sources"."value" >= 0)
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "users_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_source_fk" FOREIGN KEY ("source_id","user_id","pool") REFERENCES "public"."sources"("id","user_id","kind") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incomes" ADD CONSTRAINT "incomes_month_id_months_id_fk" FOREIGN KEY ("month_id") REFERENCES "public"."months"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "month_goals" ADD CONSTRAINT "month_goals_month_id_months_id_fk" FOREIGN KEY ("month_id") REFERENCES "public"."months"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "month_goals" ADD CONSTRAINT "month_goals_goal_id_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "month_goals" ADD CONSTRAINT "month_goals_source_fk" FOREIGN KEY ("source_id","pool") REFERENCES "public"."sources"("id","kind") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "months" ADD CONSTRAINT "months_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sources" ADD CONSTRAINT "sources_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "goals_user_id_idx" ON "goals" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "incomes_month_id_idx" ON "incomes" USING btree ("month_id");--> statement-breakpoint
CREATE INDEX "month_goals_goal_id_idx" ON "month_goals" USING btree ("goal_id");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");