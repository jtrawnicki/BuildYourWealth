-- Zakładana roczna stopa zwrotu źródła (SPEC 5.2, reguła 6.14, T28), tylko do
-- prognozy majątku. Setne procenta (6,50% = 650), null = brak (liczona jako
-- 0%), CHECK od −50% do 20% (SPEC P31). Migracja dodająca, bez zmiany danych:
-- istniejące źródła dostają null, więc poprzednie wdrożenie dalej działa.
ALTER TABLE "sources" ADD COLUMN "expected_return" integer;--> statement-breakpoint
ALTER TABLE "sources" ADD CONSTRAINT "sources_expected_return_check" CHECK ("sources"."expected_return" is null or "sources"."expected_return" between -5000 and 2000);
