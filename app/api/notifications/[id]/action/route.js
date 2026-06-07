import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import sql from '@/lib/db';

export async function POST(request, { params }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { id } = await params;
  const { action } = await request.json(); // 'accept' | 'reject'

  const [notif] = await sql`
    SELECT id, type, reference_id, from_user_id, amount
    FROM notifications
    WHERE id = ${id} AND user_id = ${session.userId}
  `;
  if (!notif) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

  if (notif.type === 'charge_paid' && notif.reference_id) {
    const chargeId = notif.reference_id;
    const [charge] = await sql`
      SELECT c.id, c.amount::float FROM charges c
      JOIN expenses e ON e.id = c.expense_id
      WHERE c.id = ${chargeId} AND e.user_id = ${session.userId}
    `;
    if (charge) {
      if (action === 'accept') {
        if (notif.amount != null) {
          // Partial payment: accumulate paid_amount, mark fully paid if complete
          await sql`
            UPDATE charges
            SET paid_amount = LEAST(COALESCE(paid_amount, 0) + ${notif.amount}, amount)
            WHERE id = ${chargeId}
          `;
          await sql`
            UPDATE charges SET paid = TRUE
            WHERE id = ${chargeId} AND COALESCE(paid_amount, 0) >= amount
          `;
        } else {
          await sql`UPDATE charges SET paid = TRUE WHERE id = ${chargeId}`;
        }
      }
      // reject: charge stays unpaid, nothing to do
    }
  }

  await sql`UPDATE notifications SET read = TRUE WHERE id = ${id}`;
  return NextResponse.json({ success: true });
}
