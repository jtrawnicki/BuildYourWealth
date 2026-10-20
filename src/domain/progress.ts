// Postęp celu i stan „osiągnięty” (SPEC 5.3, 6.6, 6.9). Postęp jest w walucie
// źródła celu; dla celu w EUR sumuje faktyczne kwoty w EUR, bez przeliczania
// kursem (SPEC 6.9).

/**
 * Postęp celu (SPEC 6.6): kwota startowa (puste pole = 0) plus suma faktycznych
 * kwot z rozliczonych miesięcy dla tego celu. Ręczne zmiany wartości źródła nie
 * wchodzą do postępu — liczą się tylko rozliczone wpłaty.
 */
export function goalProgress(
  startAmount: number | null,
  settledAmounts: number[],
): number {
  return settledAmounts.reduce((sum, amount) => sum + amount, startAmount ?? 0);
}

/**
 * Czy cel jest „osiągnięty” (SPEC 5.3): tylko cel z kwotą docelową, gdy postęp
 * jest większy lub równy tej kwocie. Kwota docelowa 0 oznacza cel osiągnięty od
 * razu. Cel bez kwoty docelowej nie pokazuje postępu i nie bywa „osiągnięty”.
 */
export function isGoalReached(
  progress: number,
  targetAmount: number | null,
): boolean {
  return targetAmount !== null && progress >= targetAmount;
}
