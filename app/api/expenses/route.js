import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import sql from '@/lib/db';
import { createExpenseWithCharges } from '@/lib/expenses';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const expenses = await sql`
    SELECT e.id, e.name, e.total::float, e.date, e.my_share::float, e.month, e.installment_plan_id,
      COALESCE(json_agg(
        json_build_object(
          'id', c.id, 'person', c.person_name,
          'personUserId', c.person_user_id,
          'amount', c.amount::float, 'paid', c.paid,
          'paidAmount', COALESCE(c.paid_amount, 0)::float
        ) ORDER BY c.id
      ) FILTER (WHERE c.id IS NOT NULL), '[]') as charges
    FROM expenses e
    LEFT JOIN charges c ON c.expense_id = e.id
    WHERE e.user_id = ${session.userId}
    GROUP BY e.id
    ORDER BY e.date DESC, e.created_at DESC
  `;

  return NextResponse.json(expenses.map(e => ({
    id: e.id, name: e.name, total: e.total,
    date: e.date ? e.date.toISOString().slice(0, 10) : null,
    myShare: e.my_share, month: e.month, charges: e.charges,
    installmentPlanId: e.installment_plan_id,
  })));
}

export async function POST(request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { name, total, date, myShare, month, charges } = await request.json();
  const id = await createExpenseWithCharges({ userId: session.userId, name, total, date, myShare, month, charges });

  return NextResponse.json({ id });
}
