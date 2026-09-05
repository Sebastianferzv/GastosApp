import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import sql from '@/lib/db';

// Solicita liquidar todo el saldo (en ambas direcciones) con otra persona registrada.
// No marca nada pagado de inmediato: crea una única notificación que, al ser aceptada
// por la otra persona, marca como pagados todos los cargos incluidos.
export async function POST(request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { toUserId, chargeIds } = await request.json();
  if (!toUserId || !Array.isArray(chargeIds) || chargeIds.length === 0) {
    return NextResponse.json({ error: 'Faltan datos.' }, { status: 400 });
  }

  const rows = await sql`
    SELECT c.id, c.amount::float, (e.user_id = ${toUserId}) as recipient_is_creditor
    FROM charges c
    JOIN expenses e ON e.id = c.expense_id
    WHERE c.id = ANY(${chargeIds}) AND c.paid = FALSE AND (
      (e.user_id = ${session.userId} AND c.person_user_id = ${toUserId})
      OR (e.user_id = ${toUserId} AND c.person_user_id = ${session.userId})
    )
  `;
  if (rows.length === 0) return NextResponse.json({ error: 'Nada pendiente para liquidar.' }, { status: 400 });

  const validIds = rows.map(r => r.id);
  const net = rows.reduce((s, r) => s + (r.recipient_is_creditor ? r.amount : -r.amount), 0);

  const [me] = await sql`SELECT display_name FROM users WHERE id = ${session.userId}`;
  const roundedNet = Math.round(Math.abs(net));
  const message = net >= 0
    ? `${me.display_name} propone liquidar cuentas: te debe $${roundedNet} en total.`
    : `${me.display_name} propone liquidar cuentas: le debes $${roundedNet} en total.`;

  // Solo una solicitud de liquidación pendiente a la vez entre estas dos personas.
  await sql`
    DELETE FROM notifications
    WHERE type = 'settle_request' AND read = FALSE
      AND ((user_id = ${toUserId} AND from_user_id = ${session.userId})
        OR (user_id = ${session.userId} AND from_user_id = ${toUserId}))
  `;

  await sql`
    INSERT INTO notifications (user_id, type, message, from_user_id, charge_ids)
    VALUES (${toUserId}, 'settle_request', ${message}, ${session.userId}, ${validIds})
  `;

  return NextResponse.json({ success: true });
}
