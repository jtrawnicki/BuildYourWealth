-- Klucze obce między danymi jednego użytkownika są sprawdzane na końcu
-- transakcji. Kaskada z `users` usuwa cele i źródła w dowolnej kolejności
-- względem migawek miesięcy; sprawdzenie natychmiastowe przerwałoby ją.
-- Twarde usunięcie celu lub źródła używanego w migawce nadal jest odrzucane.
ALTER TABLE "month_goals" ALTER CONSTRAINT "month_goals_goal_id_goals_id_fk" DEFERRABLE INITIALLY DEFERRED;--> statement-breakpoint
ALTER TABLE "month_goals" ALTER CONSTRAINT "month_goals_source_id_sources_id_fk" DEFERRABLE INITIALLY DEFERRED;--> statement-breakpoint
ALTER TABLE "goals" ALTER CONSTRAINT "goals_source_fk" DEFERRABLE INITIALLY DEFERRED;
