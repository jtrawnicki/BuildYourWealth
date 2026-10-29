ALTER TABLE "months" ADD COLUMN "settled_rate_date" date;--> statement-breakpoint
ALTER TABLE "months" ADD COLUMN "settled_rate_source" text;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "fallback_eur_rate" integer;--> statement-breakpoint
ALTER TABLE "months" ADD CONSTRAINT "months_settled_rate_source_check" CHECK ("months"."settled_rate_source" in ('nbp', 'fallback', 'manual'));--> statement-breakpoint
-- Dopisane ręcznie (SPEC 5.9, reguła 6.10): rozliczone przed Etapem 2 miesiące
-- z celem EUR mają kurs z ręcznego ustawienia, więc ich pochodzenie to `manual`.
-- Backfill musi wyprzedzić CHECK spójności niżej, który inaczej odrzuciłby te
-- wiersze (kurs jest, pochodzenia jeszcze nie).
UPDATE "months" SET "settled_rate_source" = 'manual' WHERE "settled_eur_rate" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "months" ADD CONSTRAINT "months_settled_rate_source_eur_rate_check" CHECK (("months"."settled_eur_rate" is null) = ("months"."settled_rate_source" is null));--> statement-breakpoint
ALTER TABLE "months" ADD CONSTRAINT "months_settled_rate_date_check" CHECK (("months"."settled_rate_date" is not null) = ("months"."settled_rate_source" = 'nbp'));--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_fallback_eur_rate_check" CHECK ("settings"."fallback_eur_rate" > 0);
