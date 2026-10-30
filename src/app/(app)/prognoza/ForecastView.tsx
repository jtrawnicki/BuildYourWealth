"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { formatMoney, formatPercentFixed } from "@/domain/format";
import { formatMonthYear } from "@/domain/month-name";
import {
  SCENARIOS,
  parseHorizonYears,
  summarizeHorizon,
  yearsPhrase,
  type Scenario,
  type WealthSeries,
} from "@/domain/wealth-forecast";
import { ProfitChart } from "./ProfitChart";
import { ScenarioChart } from "./ScenarioChart";
import type { SourceMeta } from "./forecast-data";
import {
  SCENARIO_NAME,
  cardContributionText,
  cardDiffText,
  controlSentenceText,
  formatThresholdShort,
  formatZloty,
  incomeSourceNote,
  profitSentenceText,
  rateLabel,
  savedBreakdown,
  sourcesRateNote,
} from "./text";
import styles from "./page.module.css";

const HORIZON_BUTTONS = [5, 10, 15] as const;
const DEFAULT_YEARS = 10;

type Props = {
  series: WealthSeries;
  sources: SourceMeta[];
  eurRateText: string | null;
};

export function ForecastView({ series, sources, eurRateText }: Props) {
  const [years, setYears] = useState<number>(DEFAULT_YEARS);
  const [custom, setCustom] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [scenario, setScenario] = useState<Scenario>(0);

  // Podsumowanie liczy się po stronie klienta z gotowych serii, więc zmiana
  // horyzontu nie wysyła żądania do serwera (SPEC scen. 47).
  const summary = useMemo(
    () => summarizeHorizon(series, years),
    [series, years],
  );

  function pickButton(value: number) {
    setYears(value);
    setCustom("");
    setError(null);
  }

  // Puste pole zostawia bieżący wybór bez komunikatu; niepoprawna wartość nie
  // zmienia prognozy i pokazuje komunikat; liczba 5/10/15 zaznacza przycisk,
  // bo przycisk jest aktywny, gdy równa się horyzontowi (SPEC 5.13, scen. 44).
  function changeCustom(value: string) {
    setCustom(value);
    if (value.trim() === "") {
      setError(null);
      return;
    }
    const parsed = parseHorizonYears(value);
    if (parsed.ok) {
      setYears(parsed.value);
      setError(null);
    } else {
      setError(parsed.error);
    }
  }

  const sp = series.startingPoint;
  const layer = summary.layers[scenario];
  const scenarioNetWorth = summary.cards.find(
    (card) => card.scenario === scenario,
  )!.netWorth;

  return (
    <>
      <section className={styles.card} aria-labelledby="punkt">
        <h2 id="punkt" className={styles.cardTitle}>
          Punkt wyjścia
        </h2>
        <dl className={styles.facts}>
          <Fact
            label="Majątek dziś"
            value={formatMoney(sp.netWorthToday, "PLN")}
          />
          <Fact
            label="Średni przychód"
            value={formatMoney(sp.averageIncome, "PLN")}
            note={incomeSourceNote(sp.incomeSource)}
          />
          <Fact
            label="Odkładasz według planu"
            value={formatPercentFixed(sp.savedPct)}
            note={savedBreakdown(sp.savingsPct, sp.investmentsPct)}
          />
          <Fact
            label="Wpłata według planu"
            value={formatMoney(sp.planContribution, "PLN")}
            note="miesięcznie"
          />
        </dl>
        {series.controlSentence && (
          <p className={styles.info}>
            {controlSentenceText(series.controlSentence)}
          </p>
        )}
      </section>

      <section className={styles.card} aria-labelledby="wykres">
        <div className={styles.chartHead}>
          <h2 id="wykres" className={styles.cardTitle}>
            Majątek w kolejnych latach
          </h2>
          <div
            className={styles.horizon}
            role="group"
            aria-label="Horyzont prognozy"
          >
            {HORIZON_BUTTONS.map((value) => (
              <button
                key={value}
                type="button"
                className={styles.chip}
                aria-pressed={years === value}
                onClick={() => pickButton(value)}
              >
                {value} lat
              </button>
            ))}
            <label className={styles.customField}>
              <span className={styles.customText}>albo</span>
              <input
                className={styles.customInput}
                inputMode="numeric"
                aria-label="Własna liczba lat"
                value={custom}
                onChange={(event) => changeCustom(event.target.value)}
              />
              <span className={styles.customText}>lat</span>
            </label>
          </div>
        </div>
        {error && (
          <p className={styles.fieldError} role="alert">
            {error}
          </p>
        )}

        <ScenarioChart
          currentMonth={series.currentMonth}
          months={summary.monthIndex}
          scenarioNetWorth={series.scenarioNetWorth}
          milestones={summary.milestones}
        />

        <div className={styles.scenarioCards}>
          {summary.cards.map((card) => (
            <div
              key={card.scenario}
              role="group"
              aria-label={SCENARIO_NAME[card.scenario]}
              className={`${styles.scenarioCard} ${card.scenario === 0 ? styles.scenarioBase : ""}`}
            >
              <span className={styles.scenarioName}>
                {SCENARIO_NAME[card.scenario]}
              </span>
              <span className={styles.scenarioWorth}>
                {formatZloty(card.netWorth)}
              </span>
              <span className={styles.scenarioMeta}>
                {cardContributionText(card)}
              </span>
              {card.scenario === 0 ? (
                <span className={styles.scenarioMeta}>
                  {cardDiffText(card)}
                </span>
              ) : (
                <span className={styles.scenarioDiff}>
                  {cardDiffText(card)}
                </span>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className={styles.card} aria-labelledby="zysk">
        <div className={styles.chartHead}>
          <h2 id="zysk" className={styles.cardTitle}>
            Wpłaty kontra zysk
          </h2>
          <div className={styles.horizon} role="group" aria-label="Scenariusz">
            {SCENARIOS.map((value) => (
              <button
                key={value}
                type="button"
                className={styles.chip}
                aria-pressed={scenario === value}
                onClick={() => setScenario(value)}
              >
                {SCENARIO_NAME[value]}
              </button>
            ))}
          </div>
        </div>
        <p className={styles.info}>
          {profitSentenceText(layer.sentence, years)}
        </p>
        <div className={styles.profitWrap}>
          <ProfitChart
            months={summary.monthIndex}
            netWorthToday={series.scenarioNetWorth[0][0]}
            contribution={series.scenarioContribution[scenario]}
            total={series.scenarioNetWorth[scenario]}
            withProfit={layer.legend.profit > 0}
          />
          <dl className={styles.legend}>
            <LegendRow
              swatch={styles.swatchToday}
              label="Majątek dziś"
              value={formatZloty(layer.legend.netWorthToday)}
            />
            <LegendRow
              swatch={styles.swatchContrib}
              label="Suma wpłat"
              value={formatZloty(layer.legend.contributions)}
            />
            <LegendRow
              swatch={styles.swatchProfit}
              label="Zysk z założonych stóp"
              value={formatZloty(layer.legend.profit)}
            />
            <div className={`${styles.legendRow} ${styles.legendTotal}`}>
              <dt>Razem</dt>
              <dd>{formatZloty(scenarioNetWorth)}</dd>
            </div>
          </dl>
        </div>
      </section>

      <section className={styles.card} aria-labelledby="progi">
        <h2 id="progi" className={styles.cardTitle}>
          Kamienie milowe
        </h2>
        {summary.milestones.length === 0 ? (
          <p className={styles.empty}>
            W tym horyzoncie nie ma kolejnego progu do pokazania.
          </p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Próg</th>
                  {SCENARIOS.map((value) => (
                    <th key={value} scope="col">
                      {SCENARIO_NAME[value]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {summary.milestones.map((milestone) => (
                  <tr key={milestone.threshold}>
                    <th scope="row">
                      {formatThresholdShort(milestone.threshold)} zł
                    </th>
                    {SCENARIOS.map((value) => {
                      const reach = milestone.reached[value];
                      return (
                        <td key={value}>
                          {reach
                            ? formatMonthYear(reach.month)
                            : "poza horyzontem"}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className={styles.card} aria-labelledby="zrodla">
        <h2 id="zrodla" className={styles.cardTitle}>
          Źródła w prognozie
        </h2>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Źródło</th>
                <th scope="col">Pula i cel</th>
                <th scope="col">Stopa</th>
                <th scope="col">Wpłata</th>
                <th scope="col">Dziś</th>
                <th scope="col">Za {yearsPhrase(years)}</th>
              </tr>
            </thead>
            <tbody>
              {summary.sources.map((row) => {
                const meta = sources.find((source) => source.id === row.id)!;
                const today =
                  meta.eurValue !== null
                    ? `${formatZloty(row.today)} (${formatMoney(meta.eurValue, "EUR")})`
                    : formatZloty(row.today);
                return (
                  <tr key={row.id}>
                    <th scope="row">{meta.name}</th>
                    <td>
                      {meta.poolTitle}
                      {meta.goalsLabel
                        ? ` · ${meta.goalsLabel}`
                        : " · bez celu"}
                    </td>
                    <td>{rateLabel(meta.rate)}</td>
                    <td>{formatZloty(row.contribution)}</td>
                    <td>{today}</td>
                    <td>{formatZloty(row.end)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className={styles.sourcesNote}>
          {sourcesRateNote(
            sources.filter((source) => source.rate === null).length,
            sources.length,
          )}
        </p>
        {eurRateText && (
          <p className={styles.sourcesNote}>
            Źródło w EUR przeliczone po bieżącym kursie {eurRateText}, stałym
            przez cały horyzont.
          </p>
        )}
        <Link href="/majatek" className={styles.link}>
          Zmień stopy na ekranie Majątek
        </Link>
      </section>

      <p className={styles.disclaimer}>
        Symulacja na podstawie Twoich założeń, nie prognoza rynku. Kwoty w
        złotych po bieżącym kursie EUR, bez inflacji i podatków.
      </p>
    </>
  );
}

function Fact({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <div className={styles.fact}>
      <dt className={styles.factLabel}>{label}</dt>
      <dd className={styles.factValue}>{value}</dd>
      {note && <p className={styles.factNote}>{note}</p>}
    </div>
  );
}

function LegendRow({
  swatch,
  label,
  value,
}: {
  swatch: string;
  label: string;
  value: string;
}) {
  return (
    <div className={styles.legendRow}>
      <dt>
        <span className={`${styles.swatch} ${swatch}`} aria-hidden="true" />
        {label}
      </dt>
      <dd>{value}</dd>
    </div>
  );
}
