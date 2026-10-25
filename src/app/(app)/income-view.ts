import { formatMoney } from "@/domain/format";
import type { IncomeView } from "./IncomeItem";

/** Składa widok pozycji przychodu (lista + wartości startowe edycji, SPEC 5.4). */
export function toIncomeView(income: {
  id: number;
  name: string;
  amount: number;
}): IncomeView {
  return {
    id: income.id,
    name: income.name,
    amountText: formatMoney(income.amount, "PLN"),
    form: { name: income.name, amount: formatAmountField(income.amount) },
  };
}

// Kwota do pola edycji bez symbolu waluty: `850000` → `8 500,00`.
function formatAmountField(amount: number): string {
  return formatMoney(amount, "PLN").replace(/\s*zł$/u, "");
}
