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
      SELECT c.id, c.amount::float, c.expense_id, c.person_name, c.person_user_id
      FROM charges c
      JOIN expenses e ON e.id = c.expense_id
      WHERE c.id = ${chargeId} AND e.user_id = ${session.userId}
    `;
    if (charge) {
      if (action === 'accept') {
        await sql`UPDATE charges SET paid = TRUE WHERE id = ${chargeId}`;
      }
      // reject: charge stays unpaid, nothing to do
    }
  }

  await sql`UPDATE notifications SET read = TRUE WHERE id = ${id}`;
  return NextResponse.json({ success: true });
}
