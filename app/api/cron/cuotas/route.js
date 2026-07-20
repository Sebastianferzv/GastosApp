import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { processDuePlan } from '@/lib/installments';

export async function GET(request) {
  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const currentYearMonth = new Date().toISOString().slice(0, 7);
  const plans = await sql`
    SELECT * FROM installment_plans
    WHERE created_count < total_count AND next_month <= ${currentYearMonth}
  `;

  for (const plan of plans) await processDuePlan(plan, currentYearMonth);

  return NextResponse.json({ processed: plans.length });
}
