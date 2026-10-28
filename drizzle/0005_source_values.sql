CREATE TABLE "source_values" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "source_values_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" integer NOT NULL,
	"source_id" integer NOT NULL,
	"value" bigint NOT NULL,
	"currency" text NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reason" text NOT NULL,
	CONSTRAINT "source_values_value_check" CHECK ("source_values"."value" >= 0),
	CONSTRAINT "source_values_currency_check" CHECK ("source_values"."currency" in ('PLN', 'EUR')),
	CONSTRAINT "source_values_reason_check" CHECK ("source_values"."reason" in ('initial', 'created', 'manual', 'settlement', 'archived'))
);
--> statement-breakpoint
ALTER TABLE "source_values" ADD CONSTRAINT "source_values_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_values" ADD CONSTRAINT "source_values_source_fk" FOREIGN KEY ("source_id","user_id") REFERENCES "public"."sources"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "source_values_source_id_recorded_at_idx" ON "source_values" USING btree ("source_id","recorded_at");--> statement-breakpoint
CREATE INDEX "source_values_user_id_idx" ON "source_values" USING btree ("user_id");--> statement-breakpoint
-- Dopisane ręcznie (STACK 5 „Historia wartości”): punkt startowy historii dla
-- wszystkich istniejących źródeł, także zarchiwizowanych (te mają wartość 0).
INSERT INTO "source_values" ("user_id", "source_id", "value", "currency", "recorded_at", "reason")
SELECT "user_id", "id", "value", "currency", now(), 'initial' FROM "sources";
