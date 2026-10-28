CREATE TABLE "exchange_rates" (
	"currency" text NOT NULL,
	"effective_date" date NOT NULL,
	"rate" integer NOT NULL,
	"table_no" text NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "exchange_rates_currency_effective_date_pk" PRIMARY KEY("currency","effective_date"),
	CONSTRAINT "exchange_rates_currency_check" CHECK ("exchange_rates"."currency" in ('EUR')),
	CONSTRAINT "exchange_rates_rate_check" CHECK ("exchange_rates"."rate" > 0)
);
--> statement-breakpoint
CREATE TABLE "rate_fetches" (
	"currency" text PRIMARY KEY NOT NULL,
	"attempted_at" timestamp with time zone NOT NULL,
	"ok" boolean NOT NULL,
	CONSTRAINT "rate_fetches_currency_check" CHECK ("rate_fetches"."currency" in ('EUR'))
);
