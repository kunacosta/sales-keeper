import { Brand } from './stateService.ts';
import { fmt, formatDate, getMonthYear } from './format.ts';

export interface BrandStat {
  dailyRM: number;
  dailyQty: number;
  mtdRM: number;
  mtdQty: number;
}

export type SummaryDraft = Record<string, { rm: string; qty: string }>;

/**
 * Builds the WhatsApp summary text. The daily figure per brand comes from the
 * draft; when `seedFromSaved` is set and a brand has no draft entry, the saved
 * daily value is used instead (so a post-save / standalone receipt is correct).
 */
export function buildWhatsappSummary(
  brands: Brand[],
  brandStats: Record<string, BrandStat>,
  draft: SummaryDraft,
  entryDate: string,
  opts: { seedFromSaved?: boolean } = {}
): string {
  if (brands.length === 0) return 'No data available...';

  const d = new Date(entryDate);
  const dateLabel = formatDate(entryDate);
  const dayNum = d.getDate();
  const monthYr = getMonthYear(entryDate);

  const brandLines: string[] = [];
  let totalDay = 0;
  let totalMon = 0;

  brands.forEach(b => {
    const s = brandStats[b.id] || { dailyRM: 0, dailyQty: 0, mtdRM: 0, mtdQty: 0 };
    const hasDraft = draft[b.id] !== undefined;

    const dRM = hasDraft
      ? parseFloat(draft[b.id].rm) || 0
      : opts.seedFromSaved ? s.dailyRM : 0;
    const dQty = hasDraft
      ? parseInt(draft[b.id].qty) || 0
      : opts.seedFromSaved ? s.dailyQty : 0;

    const mRM = s.mtdRM - s.dailyRM + dRM;
    const mQty = s.mtdQty - s.dailyQty + dQty;

    if (dRM > 0 || dQty > 0 || mRM > 0) {
      brandLines.push(`${b.name} =${fmt(dRM)}/${fmt(mRM)}⌚${fmt(dQty)}/${fmt(mQty)}`);
      totalDay += dRM;
      totalMon += mRM;
    }
  });

  return [
    `${dateLabel}(MRT)`,
    `*Sale RM ${fmt(totalDay)}`,
    ...brandLines,
    `\nTotal 1-${dayNum} ${monthYr}`,
    `*Rm ${fmt(totalMon)}`
  ].join('\n');
}
