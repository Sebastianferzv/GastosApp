// Suma n meses calendario a 'YYYY-MM', preservando el día (recortado al último día
// válido del mes resultante). Devuelve {date:'YYYY-MM-DD', month:'YYYY-MM'}.
export function addMonthsISO(baseYearMonth, n, dayOfMonth) {
  const [by, bm] = baseYearMonth.split('-').map(Number);
  const total = (bm - 1) + n;
  const y = by + Math.floor(total / 12);
  const m = (total % 12) + 1;
  const lastDay = new Date(y, m, 0).getDate();
  const day = Math.min(dayOfMonth, lastDay);
  return {
    date: `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    month: `${y}-${String(m).padStart(2, '0')}`,
  };
}
