"use client";

import { useActionState, useState } from "react";
import { convertEurToPln } from "@/domain/currency";
import { formatMoney } from "@/domain/format";
import { parseActualAmount } from "@/domain/input";
import { SaveError } from "@/ui/SaveError";
import { settleAction } from "./actions";
import type { SettleState } from "./state";
import styles from "./page.module.css";

export type SettleGoalView = {
  goalId: number;
  name: string;
  sourceName: string;
  currency: "PLN" | "EUR";
  /** Kwota planu w PLN (zawsze pokazywana jako odniesienie). */
  planLabel: string;
  /** Wstępnie wpisana kwota faktyczna w walucie źródła, bez symbolu. */
  actualField: string;
  /** Podpowiedź dla celu w EUR: po jakim kursie przeliczono plan. */
  eurHint: string | null;
};

export type SettleGroupView = {
  pool: "savings" | "investments";
  title: string;
  totalPlanLabel: string;
  items: SettleGoalView[];
};

export type SettleView = {
  month: string;
  monthTitle: string;
  incomeLabel: string;
  /** Dokładna suma planu w PLN (podtytuł „Plan: …"). */
  planSumLabel: string;
  /** Suma trafiająca do źródeł w opcji „plan"; dla EUR przeliczona wstecz (≈). */
  planTotalLabel: string;
  goalCountLabel: string;
  hasEur: boolean;
  groups: SettleGroupView[];
};

type Mode = "plan" | "manual";

const DOT: Record<SettleGroupView["pool"], string> = {
  savings: styles.dotSave,
  investments: styles.dotInvest,
};

/** Suma faktycznych kwot sprowadzona do PLN (EUR po kursie); `null`, gdy pole ma błąd. */
function totalPln(
  view: SettleView,
  values: Record<number, string>,
  rate: number | null,
): number | null {
  let sum = 0;
  for (const group of view.groups) {
    for (const item of group.items) {
      const parsed = parseActualAmount(values[item.goalId] ?? "");
      if (!parsed.ok) return null;
      if (item.currency === "PLN") sum += parsed.value;
      else if (rate !== null) sum += convertEurToPln(parsed.value, rate);
    }
  }
  return sum;
}

export function SettleForm({
  view,
  eurRate,
}: {
  view: SettleView;
  eurRate: number | null;
}) {
  const [mode, setMode] = useState<Mode>("plan");
  const [values, setValues] = useState<Record<number, string>>(() => {
    const initial: Record<number, string> = {};
    for (const group of view.groups) {
      for (const item of group.items) initial[item.goalId] = item.actualField;
    }
    return initial;
  });
  const [state, formAction, pending] = useActionState(
    settleAction,
    {} satisfies SettleState,
  );

  const manual = mode === "manual";

  // W trybie ręcznym każda kwota musi być poprawna (≥ 0); w trybie „plan"
  // kwoty bierze serwer, więc formularz jest zawsze gotowy do wysłania.
  const fieldErrors: Record<number, string> = {};
  if (manual) {
    for (const group of view.groups) {
      for (const item of group.items) {
        const parsed = parseActualAmount(values[item.goalId] ?? "");
        if (!parsed.ok) fieldErrors[item.goalId] = parsed.error;
      }
    }
  }
  const canSave = !manual || Object.keys(fieldErrors).length === 0;

  const total = manual ? totalPln(view, values, eurRate) : null;
  const totalLabel =
    mode === "plan"
      ? view.planTotalLabel
      : total === null
        ? "—"
        : formatMoney(total, "PLN");
  const totalPrefix = view.hasEur && totalLabel !== "—" ? "≈ " : "";

  const actualsPayload = JSON.stringify(
    view.groups.flatMap((group) =>
      group.items.map((item) => ({
        goalId: item.goalId,
        amount: values[item.goalId] ?? "",
      })),
    ),
  );

  return (
    <form action={formAction} className={styles.form} noValidate>
      <input type="hidden" name="month" value={view.month} />
      <input type="hidden" name="mode" value={mode} />
      <input type="hidden" name="actuals" value={actualsPayload} />

      <section className={styles.intro}>
        <p className={styles.meta}>
          Rozliczenie · {view.monthTitle} · przychód {view.incomeLabel}
        </p>
        <h1 className={styles.title}>Czy udało się zrealizować plan?</h1>
        <p className={styles.sub}>
          Plan: <strong>{view.planSumLabel}</strong> na {view.goalCountLabel}.
        </p>
      </section>

      {state.saveFailed && <SaveError />}
      {state.formError && (
        <p role="alert" className={styles.formError}>
          {state.formError}
        </p>
      )}

      <div
        role="radiogroup"
        aria-label="Sposób rozliczenia"
        className={styles.options}
      >
        <button
          type="button"
          role="radio"
          aria-checked={!manual}
          onClick={() => setMode("plan")}
          className={`${styles.option} ${!manual ? styles.optionActive : ""}`}
        >
          <span className={styles.optionTitle}>Tak, plan zrealizowany</span>
          <span className={styles.optionDesc}>
            Wszystkie zaplanowane kwoty trafią do źródeł bez zmian.
          </span>
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={manual}
          onClick={() => setMode("manual")}
          className={`${styles.option} ${manual ? styles.optionActive : ""}`}
        >
          <span className={styles.optionTitle}>
            Nie, wpiszę faktyczne kwoty
          </span>
          <span className={styles.optionDesc}>
            Podaj, ile naprawdę przelałeś na każdy cel (także 0).
          </span>
        </button>
      </div>

      {view.groups.map((group) => (
        <section
          key={group.pool}
          className={styles.card}
          aria-label={group.title}
        >
          <div className={styles.cardHead}>
            <h2 className={styles.groupTitle}>
              <span className={`${styles.dot} ${DOT[group.pool]}`} />
              {group.title}
            </h2>
            <span className={styles.groupTotal}>
              plan {group.totalPlanLabel}
            </span>
          </div>
          <ul className={styles.items}>
            {group.items.map((item) => {
              const inputId = `actual-${item.goalId}`;
              const error = manual ? fieldErrors[item.goalId] : undefined;
              return (
                <li
                  key={item.goalId}
                  className={styles.item}
                  aria-label={item.name}
                >
                  <div className={styles.itemMain}>
                    <span className={styles.itemName}>{item.name}</span>
                    <span className={styles.itemSource}>
                      na: {item.sourceName} · plan {item.planLabel}
                    </span>
                  </div>
                  {manual ? (
                    <div className={styles.field}>
                      <label htmlFor={inputId} className={styles.fieldLabel}>
                        Faktycznie wpłacono ({item.currency})
                      </label>
                      <input
                        id={inputId}
                        value={values[item.goalId] ?? ""}
                        onChange={(event) =>
                          setValues((prev) => ({
                            ...prev,
                            [item.goalId]: event.target.value,
                          }))
                        }
                        inputMode="decimal"
                        autoComplete="off"
                        aria-invalid={error ? true : undefined}
                        aria-describedby={
                          error ? `${inputId}-error` : undefined
                        }
                        className={`${styles.input} ${styles.amountInput}`}
                      />
                      {item.eurHint && (
                        <span className={styles.hint}>{item.eurHint}</span>
                      )}
                      {error && (
                        <p
                          id={`${inputId}-error`}
                          className={styles.fieldError}
                        >
                          {error}
                        </p>
                      )}
                    </div>
                  ) : (
                    <span className={styles.planAmount}>
                      {formatMoney(
                        parseActualAmountOrZero(values[item.goalId]),
                        item.currency,
                      )}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      <section className={styles.summary}>
        <div className={styles.summaryMain}>
          <span className={styles.summaryLabel}>Do źródeł trafi łącznie</span>
          <span className={styles.summaryTotal}>
            {totalPrefix}
            {totalLabel}
          </span>
          <span className={styles.summaryNote}>
            Po zatwierdzeniu {view.monthTitle} będzie tylko do odczytu.
          </span>
        </div>
        <button
          type="submit"
          className={styles.submit}
          disabled={!canSave || pending}
        >
          {pending ? "Zapisywanie…" : "Zatwierdź rozliczenie"}
        </button>
      </section>
    </form>
  );
}

/** Kwota z pola do podglądu „plan" (pole jest poprawne, bo pochodzi z prefillu). */
function parseActualAmountOrZero(value: string | undefined): number {
  const parsed = parseActualAmount(value ?? "");
  return parsed.ok ? parsed.value : 0;
}
