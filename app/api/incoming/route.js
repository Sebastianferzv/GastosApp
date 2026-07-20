import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import sql from '@/lib/db';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const charges = await sql`
    SELECT
      c.id, c.amount::float, c.paid, COALESCE(c.paid_amount, 0)::float as paid_amount, c.expense_id,
      e.name as expense_name, e.date, e.month,
      e.user_id as from_user_id,
      u.display_name as from_name, u.username as from_username,
      EXISTS(
        SELECT 1 FROM notifications n
        WHERE n.type = 'charge_paid' AND n.reference_id = c.id
          AND n.from_user_id = ${session.userId} AND n.read = FALSE
      ) as pending_confirmation
    FROM charges c
    JOIN expenses e ON e.id = c.expense_id
    JOIN users u ON u.id = e.user_id
    WHERE c.person_user_id = ${session.userId}
    ORDER BY e.date DESC, e.created_at DESC
  `;

  return NextResponse.json(charges.map(c => ({
    id: c.id,
    expenseId: c.expense_id,
    amount: c.amount,
    paid: c.paid,
    paidAmount: c.paid_amount,
    expenseName: c.expense_name,
    date: c.date ? c.date.toISOString().slice(0, 10) : null,
    month: c.month,
    fromUserId: c.from_user_id,
    fromName: c.from_name,
    fromUsername: c.from_username,
    pendingConfirmation: c.pending_confirmation,
  })));
}
