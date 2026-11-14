import type { Item, Settings, WhatIfResult, WhatIfScenario } from '@/domain';
import { whatIf } from '@/domain';

/** Editable text values of the three scenario cards. */
export interface ScenarioInputs {
  a: string;
  b: string;
  c: string;
  flat: string;
}

/** Parse a typed money amount ("12.5", "$12,50"); anything unusable counts as 0. */
export function parseAmount(text: string): number {
  const n = Number.parseFloat(text.replace(/[^0-9.,-]/g, '').replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Starting prices: a little under, a little over and at the item's first listing price (60 if unknown). */
export function defaultInputs(item: Pick<Item, 'firstListPrice'> | undefined): ScenarioInputs {
  const base = item?.firstListPrice && item.firstListPrice > 0 ? item.firstListPrice : 60;
  return { a: String(Math.round(base * 0.95)), b: String(Math.round(base * 1.1)), c: String(Math.round(base)), flat: '10' };
}

export function scenariosFor(inputs: ScenarioInputs, s: Settings): WhatIfScenario[] {
  const flat = parseAmount(inputs.flat);
  return [
    { label: 'Buyer pays postage', listPrice: parseAmount(inputs.a), postageCharged: s.defaultLabelCost },
    { label: 'Free postage', listPrice: parseAmount(inputs.b), postageCharged: 0 },
    { label: `Flat $${inputs.flat.trim() || '0'} postage`, listPrice: parseAmount(inputs.c), postageCharged: flat },
  ];
}

export function runWhatIf(
  item: Pick<Item, 'cost' | 'adRate'> | undefined,
  inputs: ScenarioInputs,
  s: Settings,
): WhatIfResult[] {
  return whatIf({ cost: item?.cost ?? null, adRate: item?.adRate ?? null }, scenariosFor(inputs, s), s);
}
