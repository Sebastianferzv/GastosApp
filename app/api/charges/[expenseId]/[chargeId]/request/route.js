import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import sql from '@/lib/db';

export async function POST(request, { params }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { expenseId, chargeId } = await params;

  const [charge] = await sql`
    SELECT c.id FROM charges c
    JOIN expenses e ON e.id = c.expense_id
    WHERE c.id = ${chargeId} AND c.expense_id = ${expenseId}
    AND c.person_user_id = ${session.userId} AND c.paid = FALSE
  `;
  if (!charge) return NextResponse.json({ error: 'No encontrado o ya pagado' }, { status: 404 });

  const [expense] = await sql`SELECT user_id, name FROM expenses WHERE id = ${expenseId}`;
  const [payer] = await sql`SELECT display_name FROM users WHERE id = ${session.userId}`;

  // Remove any previous pending notification for this charge to avoid duplicates
  await sql`
    DELETE FROM notifications
    WHERE type = 'charge_paid' AND reference_id = ${parseInt(chargeId)}
    AND user_id = ${expense.user_id} AND read = FALSE
  `;

  await sql`
    INSERT INTO notifications (user_id, type, message, from_user_id, reference_id)
    VALUES (${expense.user_id}, 'charge_paid', ${`${payer.display_name} quiere confirmar su pago en "${expense.name}"`}, ${session.userId}, ${parseInt(chargeId)})
  `;

  return NextResponse.json({ success: true });
}
