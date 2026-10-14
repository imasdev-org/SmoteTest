/** Estado compartido entre steps de un mismo escenario. */
export const ctx: {
  lastSearch?: string;
  orderNumber?: string;
  orderTotal?: number;
  cardTexts?: string[];
  screenBefore?: string[];
  world?: 'Super' | 'Express';
} = {};

export function resetCtx() {
  for (const k of Object.keys(ctx)) delete (ctx as any)[k];
}
