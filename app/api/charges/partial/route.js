import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import sql from '@/lib/db';

export async function POST(request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { payments } = await request.json();
  if (!Array.isArray(payments) || payments.length === 0) {
    return NextResponse.json({ error: 'Sin pagos' }, { status: 400 });
  }

  for (const { expenseId, chargeId, requestedAmount } of payments) {
    const [charge] = await sql`
      SELECT c.id, c.amount::float, COALESCE(c.paid_amount, 0)::float as paid_amount
      FROM charges c
      JOIN expenses e ON e.id = c.expense_id
      WHERE c.id = ${chargeId} AND c.expense_id = ${expenseId}
        AND c.person_user_id = ${session.userId} AND c.paid = FALSE
    `;
    if (!charge) continue;

    const [expense] = await sql`SELECT user_id, name FROM expenses WHERE id = ${expenseId}`;
    if (!expense) continue;

    const [payer] = await sql`SELECT display_name FROM users WHERE id = ${session.userId}`;

    await sql`
      DELETE FROM notifications
      WHERE type = 'charge_paid' AND reference_id = ${parseInt(chargeId)}
        AND user_id = ${expense.user_id} AND read = FALSE
    `;

    const remaining = charge.amount - charge.paid_amount;
    const isPartial = parseFloat(requestedAmount) < remaining - 0.01;
    const msg = isPartial
      ? `${payer.display_name} quiere pagar $${requestedAmount} parcialmente en "${expense.name}"`
      : `${payer.display_name} quiere confirmar su pago en "${expense.name}"`;

    await sql`
      INSERT INTO notifications (user_id, type, message, from_user_id, reference_id, amount)
      VALUES (${expense.user_id}, 'charge_paid', ${msg}, ${session.userId}, ${parseInt(chargeId)}, ${parseFloat(requestedAmount)})
    `;
  }

  return NextResponse.json({ success: true });
}
