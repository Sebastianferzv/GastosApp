import sql from './db';
import { addMonthsISO } from './dates';
import { createExpenseWithCharges } from './expenses';

// Crea todas las cuotas vencidas de un plan (normalmente 1, salvo que se haya
// saltado alguna ejecución del cron) y actualiza su progreso.
export async function processDuePlan(plan, currentYearMonth) {
  const charges = typeof plan.charges === 'string' ? JSON.parse(plan.charges) : plan.charges;
  let createdCount = plan.created_count;
  let nextMonth = plan.next_month;

  while (createdCount < plan.total_count && nextMonth <= currentYearMonth) {
    const { date, month } = addMonthsISO(nextMonth, 0, plan.day_of_month);
    const label = plan.total_count > 1 ? `${plan.name} (cuota ${createdCount + 1}/${plan.total_count})` : plan.name;
    await createExpenseWithCharges({
      userId: plan.user_id, name: label, total: plan.monthly_amount,
      date, myShare: plan.my_share, month, charges, installmentPlanId: plan.id,
    });
    createdCount += 1;
    nextMonth = addMonthsISO(nextMonth, 1, plan.day_of_month).month;
  }

  if (createdCount !== plan.created_count || nextMonth !== plan.next_month) {
    await sql`UPDATE installment_plans SET created_count = ${createdCount}, next_month = ${nextMonth} WHERE id = ${plan.id}`;
  }

  return createdCount;
}
