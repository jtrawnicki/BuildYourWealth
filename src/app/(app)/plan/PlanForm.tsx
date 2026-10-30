"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import type { PlanData, PlanSource } from "@/db/plan";
import {
  forecastGoal,
  goalDeadline,
  goalFirstMonth,
  goalMonths,
  type PlanMonth,
} from "@/domain/forecast";
import {
  FORECAST_MESSAGES,
  deadlineLine,
  requiredText,
  suggestionText,
  type DeadlineLine,
} from "@/domain/forecast-text";
import { formatAmount, formatPercent } from "@/domain/format";
import {
  MAX_DEADLINE,
  MESSAGES,
  parseGoalPercent,
  parseName,
  parseOptionalAmount,
  parsePoolPercent,
  validateDeadline,
} from "@/domain/input";
import { formatMonthName } from "@/domain/month-name";
import { validatePlan, type Pool } from "@/domain/plan";
import { goalProgress, isGoalReached } from "@/domain/progress";
import { SaveError } from "@/ui/SaveError";
import { savePlanAction } from "./actions";
import type { GoalDraft, PlanState } from "./state";
import styles from "./page.module.css";

const FULL = 10_000;

const POOLS: { pool: Pool; title: string; dot: string }[] = [
  { pool: "savings", title: "Oszczędności", dot: styles.dotSave },
  { pool: "investments", title: "Inwestycje", dot: styles.dotInvest },
];

type Row = GoalDraft & { key: string };

/**
 * Dane prognozy celów (SPEC 5.12) z serwera: istniejące miesiące z migawkami,
 * bieżący miesiąc i bieżący kurs. Prognozę i walidację terminu formularz liczy
 * sam z wartości pól, bez żądań do serwera.
 */
export type ForecastContext = {
  months: PlanMonth[];
  currentMonth: string;
  currentRate: number | null;
};

type FormValues = {
  savingsPct: string;
  investmentsPct: string;
  rows: Row[];
};

/** Procent bez znaku `%` do pola tekstowego: `2000` → `20`, `3333` → `33,33`. */
const pctField = (hundredths: number) =>
  formatPercent(hundredths).replace(/%$/, "");
const amountField = (minor: number | null) =>
  minor === null ? "" : formatAmount(minor);

function toForm(data: PlanData): FormValues {
  return {
    savingsPct: pctField(data.savingsPct),
    investmentsPct: pctField(data.investmentsPct),
    rows: data.goals.map((goal) => ({
      key: `g-${goal.id}`,
      id: goal.id,
      pool: goal.pool,
      name: goal.name,
      pct: pctField(goal.pct),
      sourceId: String(goal.sourceId),
      target: amountField(goal.targetAmount),
      start: amountField(goal.startAmount),
      deadline: goal.deadline ?? "",
    })),
  };
}

/** Lock waluty źródła celu (SPEC 6.9): persystentna waluta i rozliczone wpłaty. */
type Lock = { currency: "PLN" | "EUR"; hasSettled: boolean };

type GoalErrors = {
  name?: string;
  pct?: string;
  source?: string;
  target?: string;
  start?: string;
  deadline?: string;
};

type Validation = {
  savings: number | null;
  investments: number | null;
  poolErrors: { savings?: string; investments?: string; poolsSum?: string };
  poolStatus: Record<Pool, { ok: boolean; text: string }>;
  goalErrors: Record<string, GoalErrors>;
  canSave: boolean;
};

/** Termin rozbity na pola wyboru: `2027-03` → rok `2027`, miesiąc `03`. */
function splitDeadline(deadline: string): { year: string; month: string } {
  const [year = "", month = ""] = deadline.split("-");
  return { year, month };
}

const joinDeadline = (year: string, month: string) =>
  year === "" && month === "" ? "" : `${year}-${month}`;

function validate(
  form: FormValues,
  savedDeadlines: Map<number, string | null>,
  context: ForecastContext,
): Validation {
  const savings = parsePoolPercent(form.savingsPct);
  const investments = parsePoolPercent(form.investmentsPct);
  const poolErrors: Validation["poolErrors"] = {};
  if (!savings.ok) poolErrors.savings = savings.error;
  if (!investments.ok) poolErrors.investments = investments.error;

  const goalErrors: Record<string, GoalErrors> = {};
  let allGoalsOk = true;
  const parsedPct = new Map<string, number>();
  for (const row of form.rows) {
    const errors: GoalErrors = {};
    const name = parseName(row.name);
    const pct = parseGoalPercent(row.pct);
    const target = parseOptionalAmount(row.target);
    const start = parseOptionalAmount(row.start);
    if (!name.ok) errors.name = name.error;
    if (!pct.ok) errors.pct = pct.error;
    else parsedPct.set(row.key, pct.value);
    if (!target.ok) errors.target = target.error;
    if (!start.ok) errors.start = start.error;
    if (row.sourceId === "") errors.source = "Wybierz źródło celu.";
    // Termin (SPEC 7.1): wymaga kwoty docelowej, a zakres sprawdzamy tylko przy
    // zmianie — zapisany termin, który z czasem minął, zostaje („termin minął”).
    if (row.deadline !== "") {
      if (target.ok && target.value === null) {
        errors.deadline = MESSAGES.deadlineNeedsTarget;
      } else if (
        row.id === null ||
        savedDeadlines.get(row.id) !== row.deadline
      ) {
        const range = validateDeadline(
          row.deadline,
          firstMonthOf(row, context),
        );
        if (!range.ok) errors.deadline = range.error;
      }
    }
    if (Object.keys(errors).length > 0) {
      goalErrors[row.key] = errors;
      allGoalsOk = false;
    }
  }

  // Reguły sumy (SPEC 7.1) tylko, gdy procenty dają się policzyć; inaczej pola
  // mają już własne błędy i zapis i tak jest zablokowany.
  const canRunPlan =
    savings.ok &&
    investments.ok &&
    form.rows.every((r) => parsedPct.has(r.key));
  const issues = canRunPlan
    ? validatePlan({
        savingsPct: savings.value,
        investmentsPct: investments.value,
        goals: form.rows.map((r) => ({
          pool: r.pool,
          pct: parsedPct.get(r.key)!,
        })),
      })
    : [];
  for (const issue of issues) {
    if (issue.target === "pools") poolErrors.poolsSum = issue.message;
  }

  const poolStatus = {} as Record<Pool, { ok: boolean; text: string }>;
  for (const { pool } of POOLS) {
    const rows = form.rows.filter((r) => r.pool === pool);
    const poolPct = pool === "savings" ? savings : investments;
    const issue = issues.find((i) => i.target === pool);
    if (issue) {
      poolStatus[pool] = { ok: false, text: issue.message };
    } else if (rows.length === 0 && poolPct.ok && poolPct.value === 0) {
      poolStatus[pool] = { ok: true, text: "Bez celów" };
    } else if (rows.every((r) => parsedPct.has(r.key))) {
      const sum = rows.reduce((s, r) => s + parsedPct.get(r.key)!, 0);
      poolStatus[pool] = {
        ok: true,
        text: `Suma celów: ${formatPercent(sum)}`,
      };
    } else {
      poolStatus[pool] = { ok: false, text: "Popraw procenty celów" };
    }
  }

  const canSave =
    savings.ok &&
    investments.ok &&
    allGoalsOk &&
    poolErrors.poolsSum === undefined &&
    issues.length === 0;

  return {
    savings: savings.ok ? savings.value : null,
    investments: investments.ok ? investments.value : null,
    poolErrors,
    poolStatus,
    goalErrors,
    canSave,
  };
}

function firstMonthOf(row: Row, context: ForecastContext): string {
  return goalFirstMonth(
    goalMonths(row.id, row.pool, context.months),
    context.currentMonth,
  );
}

type Advice = { status: DeadlineLine; lines: string[] };

/**
 * Blok pod wierszem celu z terminem (SPEC 5.12, 8.1), liczony na żywo z pól:
 * status terminu (przy „brak danych” z wyjaśnieniem), a dla statusu innego niż
 * „termin minął” wymagana wpłata i sugestia procentu. Tylko dla terminu
 * poprawnego i celu z kwotą docelową, nieosiągniętego.
 */
function deadlineAdvice(
  row: Row,
  errors: GoalErrors | undefined,
  sources: PlanSource[],
  context: ForecastContext,
  poolTitle: string,
): Advice | null {
  if (row.deadline === "" || errors?.deadline || errors?.target) return null;
  if (errors?.start || errors?.source) return null;
  const source = sources.find((s) => String(s.id) === row.sourceId);
  const target = parseOptionalAmount(row.target);
  const start = parseOptionalAmount(row.start);
  if (!source || !target.ok || target.value === null || !start.ok) return null;

  const months = goalMonths(row.id, row.pool, context.months);
  const progress = goalProgress(
    start.value,
    months.flatMap((m) => (m.actualAmount === null ? [] : [m.actualAmount])),
  );
  if (isGoalReached(progress, target.value)) return null;
  const input = {
    currency: source.currency,
    targetAmount: target.value,
    progress,
    months,
    currentMonth: context.currentMonth,
    currentRate: context.currentRate,
  };
  const result = goalDeadline(input, row.deadline);
  const forecast = forecastGoal(input);
  const status = deadlineLine(result, forecast, row.deadline);
  if (result.status === "overdue") return { status, lines: [] };
  const pct = parseGoalPercent(row.pct);
  const lines = [
    result.status === "no-data" ? FORECAST_MESSAGES.noData : null,
    requiredText(result, forecast, row.deadline, source.currency),
    suggestionText(result.suggestion, poolTitle, pct.ok ? pct.value : null),
  ];
  return {
    status,
    lines: lines.filter((line): line is string => line !== null),
  };
}

function SplitBar({
  savings,
  investments,
}: {
  savings: number;
  investments: number;
}) {
  const s = Math.max(0, Math.min(100, savings / 100));
  const i = Math.max(0, Math.min(100 - s, investments / 100));
  const spend = Math.max(0, 100 - s - i);
  return (
    <div className={styles.bar} aria-hidden="true">
      <span className={styles.barSave} style={{ width: `${s}%` }} />
      <span className={styles.barInvest} style={{ width: `${i}%` }} />
      <span className={styles.barSpend} style={{ width: `${spend}%` }} />
    </div>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  error,
  hint,
  inputMode,
  placeholder,
  className,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
  inputMode?: "decimal";
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={`${styles.field} ${className ?? ""}`}>
      <label htmlFor={id} className={styles.fieldLabel}>
        {label}
      </label>
      <input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        inputMode={inputMode}
        placeholder={placeholder}
        autoComplete="off"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={styles.input}
      />
      {hint && <span className={styles.hint}>{hint}</span>}
      {error && (
        <p id={`${id}-error`} className={styles.fieldError}>
          {error}
        </p>
      )}
    </div>
  );
}

const MONTH_KEYS = Array.from({ length: 12 }, (_, i) =>
  String(i + 1).padStart(2, "0"),
);

function DeadlineField({
  id,
  value,
  years,
  error,
  onChange,
}: {
  id: string;
  value: string;
  years: number[];
  error?: string;
  onChange: (deadline: string) => void;
}) {
  const { year, month } = splitDeadline(value);
  const describedBy = error ? `${id}-error` : undefined;
  return (
    <fieldset className={`${styles.field} ${styles.goalDeadline}`}>
      <legend className={styles.fieldLabel}>Termin</legend>
      <div className={styles.deadlineInputs}>
        <select
          id={`${id}-month`}
          aria-label="Miesiąc terminu"
          value={month}
          onChange={(event) => onChange(joinDeadline(year, event.target.value))}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={styles.input}
        >
          <option value="">brak</option>
          {MONTH_KEYS.map((key) => (
            <option key={key} value={key}>
              {formatMonthName(`2000-${key}`).toLowerCase()}
            </option>
          ))}
        </select>
        <select
          id={`${id}-year`}
          aria-label="Rok terminu"
          value={year}
          onChange={(event) =>
            onChange(joinDeadline(event.target.value, month))
          }
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={styles.input}
        >
          <option value="">rok</option>
          {years.map((y) => (
            <option key={y} value={String(y)}>
              {y}
            </option>
          ))}
        </select>
      </div>
      {error && (
        <p id={`${id}-error`} className={styles.fieldError}>
          {error}
        </p>
      )}
    </fieldset>
  );
}

function GoalRow({
  row,
  sources,
  lock,
  errors,
  years,
  advice,
  onChange,
  onRemove,
}: {
  row: Row;
  sources: PlanSource[];
  lock: Lock | undefined;
  errors: GoalErrors | undefined;
  years: number[];
  advice: Advice | null;
  onChange: (patch: Partial<GoalDraft>) => void;
  onRemove: () => void;
}) {
  const id = `goal-${row.key}`;
  // Zablokowana zmiana waluty (SPEC 6.9): pokazujemy tylko źródła tej samej waluty.
  const locked =
    lock !== undefined &&
    (lock.hasSettled || row.target.trim() !== "" || row.start.trim() !== "");
  const options = sources.filter(
    (source) =>
      source.kind === row.pool &&
      (!locked || source.currency === lock!.currency),
  );
  const label = row.name.trim() === "" ? "bez nazwy" : row.name.trim();

  return (
    <div className={styles.goal} aria-label={`Cel: ${label}`}>
      <Field
        id={`${id}-name`}
        label="Nazwa celu"
        value={row.name}
        onChange={(name) => onChange({ name })}
        error={errors?.name}
        className={styles.goalName}
      />
      <div className={`${styles.field} ${styles.goalSource}`}>
        <label htmlFor={`${id}-source`} className={styles.fieldLabel}>
          Źródło
        </label>
        <select
          id={`${id}-source`}
          value={row.sourceId}
          onChange={(event) => onChange({ sourceId: event.target.value })}
          aria-invalid={errors?.source ? true : undefined}
          aria-describedby={errors?.source ? `${id}-source-error` : undefined}
          className={styles.input}
        >
          <option value="">Wybierz źródło…</option>
          {options.map((source) => (
            <option key={source.id} value={String(source.id)}>
              {source.name} ({source.currency})
            </option>
          ))}
        </select>
        {locked && (
          <span className={styles.hint}>
            Waluty nie można zmienić, bo cel ma kwotę docelową, startową albo
            rozliczone wpłaty.
          </span>
        )}
        {errors?.source && (
          <p id={`${id}-source-error`} className={styles.fieldError}>
            {errors.source}
          </p>
        )}
      </div>
      <Field
        id={`${id}-pct`}
        label="% puli"
        value={row.pct}
        onChange={(pct) => onChange({ pct })}
        error={errors?.pct}
        inputMode="decimal"
        className={styles.goalPct}
      />
      <Field
        id={`${id}-target`}
        label="Kwota docelowa"
        value={row.target}
        // Usunięcie kwoty docelowej usuwa termin (SPEC 5.12).
        onChange={(target) =>
          onChange(target.trim() === "" ? { target, deadline: "" } : { target })
        }
        error={errors?.target}
        placeholder="brak"
        inputMode="decimal"
        className={styles.goalAmount}
      />
      <Field
        id={`${id}-start`}
        label="Już uzbierane"
        value={row.start}
        onChange={(start) => onChange({ start })}
        error={errors?.start}
        placeholder="0,00"
        inputMode="decimal"
        className={styles.goalAmount}
      />
      <DeadlineField
        id={`${id}-deadline`}
        value={row.deadline}
        years={years}
        error={errors?.deadline}
        onChange={(deadline) => onChange({ deadline })}
      />
      <div className={`${styles.field} ${styles.goalAction}`}>
        <span className={styles.fieldLabel} aria-hidden="true">
          &nbsp;
        </span>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Usuń cel ${label}`}
          className={styles.remove}
        >
          Usuń
        </button>
      </div>
      {advice !== null && (
        <div className={styles.advice} role="note">
          <p>
            {advice.status.deadline} ·{" "}
            <strong>{advice.status.statusLabel}</strong>
            {advice.status.detail !== null && ` ${advice.status.detail}`}
          </p>
          {advice.lines.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      )}
    </div>
  );
}

export function PlanForm({
  initial,
  sources,
  context,
}: {
  initial: PlanData;
  sources: PlanSource[];
  context: ForecastContext;
}) {
  const [form, setForm] = useState<FormValues>(() => toForm(initial));
  const nextKey = useRef(0);

  // Po udanym zapisie serwer odświeża stronę i przysyła nowe dane (nowe id
  // celów); przestawiamy formularz na nie, żeby ponowny zapis aktualizował
  // cele, a nie tworzył ich drugi raz.
  const signature = JSON.stringify(initial);
  const lastSignature = useRef(signature);
  useEffect(() => {
    if (lastSignature.current !== signature) {
      lastSignature.current = signature;
      setForm(toForm(initial));
    }
  }, [signature, initial]);

  const [state, formAction, pending] = useActionState(savePlanAction, {
    saved: false,
  } satisfies PlanState);

  const locks = new Map<number, Lock>();
  for (const goal of initial.goals) {
    locks.set(goal.id, {
      currency: goal.currency,
      hasSettled: goal.hasSettled,
    });
  }

  const savedDeadlines = new Map(
    initial.goals.map((goal) => [goal.id, goal.deadline]),
  );
  const v = validate(form, savedDeadlines, context);

  // Lata terminu: od bieżącego (albo wcześniejszego zapisanego terminu) do 2099.
  const firstYear = Math.min(
    Number(context.currentMonth.slice(0, 4)),
    ...initial.goals.flatMap((goal) =>
      goal.deadline === null ? [] : [Number(goal.deadline.slice(0, 4))],
    ),
  );
  const years = Array.from(
    { length: Number(MAX_DEADLINE.slice(0, 4)) - firstYear + 1 },
    (_, i) => firstYear + i,
  );

  const setPool = (pool: Pool, value: string) =>
    setForm((f) =>
      pool === "savings"
        ? { ...f, savingsPct: value }
        : { ...f, investmentsPct: value },
    );
  const addGoal = (pool: Pool) =>
    setForm((f) => {
      const first = sources.find((s) => s.kind === pool);
      return {
        ...f,
        rows: [
          ...f.rows,
          {
            key: `n-${nextKey.current++}`,
            id: null,
            pool,
            name: "",
            pct: "",
            sourceId: first ? String(first.id) : "",
            target: "",
            start: "",
            deadline: "",
          },
        ],
      };
    });
  const changeGoal = (key: string, patch: Partial<GoalDraft>) =>
    setForm((f) => ({
      ...f,
      rows: f.rows.map((r) => (r.key === key ? { ...r, ...patch } : r)),
    }));
  const removeGoal = (key: string) =>
    setForm((f) => ({ ...f, rows: f.rows.filter((r) => r.key !== key) }));

  const payload = JSON.stringify({
    savingsPct: form.savingsPct,
    investmentsPct: form.investmentsPct,
    goals: form.rows.map((r) => ({
      id: r.id,
      pool: r.pool,
      name: r.name,
      pct: r.pct,
      sourceId: r.sourceId,
      target: r.target,
      start: r.start,
      deadline: r.deadline,
    })),
  });

  const totalPools =
    v.savings !== null && v.investments !== null
      ? v.savings + v.investments
      : null;

  return (
    <form action={formAction} className={styles.form} noValidate>
      <section className={styles.intro}>
        <h1 className={styles.title}>Plan podziału</h1>
        {totalPools !== null && totalPools <= FULL ? (
          <p className={styles.sentence}>
            Odkładasz <strong>{formatPercent(totalPools)} przychodu</strong>:{" "}
            {formatPercent(v.savings!)} na oszczędności i{" "}
            {formatPercent(v.investments!)} na inwestycje. Do wydania zostaje{" "}
            {formatPercent(FULL - totalPools)}.
          </p>
        ) : (
          <p className={styles.sentence}>
            Ustaw procent przychodu dla oszczędności i inwestycji. Razem mogą
            zająć najwyżej 100%.
          </p>
        )}
        <SplitBar savings={v.savings ?? 0} investments={v.investments ?? 0} />
        <p role="note" className={styles.infoNote}>
          Zmiany obowiązują od kolejnego miesiąca, który utworzysz. Istniejące
          miesiące i historia zachowują swój plan.
        </p>
      </section>

      {state.saveFailed && <SaveError />}
      {state.formError && (
        <p role="alert" className={styles.formError}>
          {state.formError}
        </p>
      )}

      {POOLS.map(({ pool, title, dot }) => {
        const rows = form.rows.filter((r) => r.pool === pool);
        const poolError =
          pool === "savings" ? v.poolErrors.savings : v.poolErrors.investments;
        const hasSource = sources.some((s) => s.kind === pool);
        const status = v.poolStatus[pool];
        return (
          <section key={pool} className={styles.card} aria-label={title}>
            <div className={styles.cardHead}>
              <h2 className={styles.groupTitle}>
                <span className={`${styles.dot} ${dot}`} />
                {title}
              </h2>
              <div className={styles.poolPct}>
                <label htmlFor={`pool-${pool}`} className={styles.fieldLabel}>
                  Procent przychodu
                </label>
                <input
                  id={`pool-${pool}`}
                  value={
                    pool === "savings" ? form.savingsPct : form.investmentsPct
                  }
                  onChange={(event) => setPool(pool, event.target.value)}
                  inputMode="decimal"
                  autoComplete="off"
                  aria-invalid={poolError ? true : undefined}
                  aria-describedby={
                    poolError ? `pool-${pool}-error` : undefined
                  }
                  className={`${styles.input} ${styles.pctInput}`}
                />
                <span aria-hidden="true">%</span>
              </div>
            </div>
            {poolError && (
              <p id={`pool-${pool}-error`} className={styles.fieldError}>
                {poolError}
              </p>
            )}

            {rows.map((row) => (
              <GoalRow
                key={row.key}
                row={row}
                sources={sources}
                lock={row.id !== null ? locks.get(row.id) : undefined}
                errors={v.goalErrors[row.key]}
                years={years}
                advice={deadlineAdvice(
                  row,
                  v.goalErrors[row.key],
                  sources,
                  context,
                  title,
                )}
                onChange={(patch) => changeGoal(row.key, patch)}
                onRemove={() => removeGoal(row.key)}
              />
            ))}

            <div className={styles.cardFoot}>
              {hasSource ? (
                <button
                  type="button"
                  onClick={() => addGoal(pool)}
                  aria-label={`Dodaj cel w puli ${title}`}
                  className={styles.addGoal}
                >
                  + Dodaj cel
                </button>
              ) : (
                <p className={styles.hint}>
                  Najpierw dodaj źródło tej puli w zakładce{" "}
                  <Link href="/majatek" className={styles.inlineLink}>
                    Majątek
                  </Link>
                  .
                </p>
              )}
              <span
                role="status"
                className={`${styles.chip} ${status.ok ? styles.chipOk : styles.chipBad}`}
              >
                {status.text}
              </span>
            </div>
          </section>
        );
      })}

      <input type="hidden" name="plan" value={payload} />

      <div className={styles.saveBar}>
        {!v.canSave && (
          <span className={styles.saveHint}>Popraw plan, aby zapisać.</span>
        )}
        <p role="status" className={styles.saved}>
          {state.saved && !pending ? "Zapisano plan." : ""}
        </p>
        <button
          type="submit"
          className={styles.submit}
          disabled={!v.canSave || pending}
        >
          {pending ? "Zapisywanie…" : "Zapisz plan"}
        </button>
      </div>
    </form>
  );
}
