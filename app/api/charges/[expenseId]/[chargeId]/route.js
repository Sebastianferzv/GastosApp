import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import sql from '@/lib/db';

export async function PUT(request, { params }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  const { expenseId, chargeId } = await params;
  const { paid } = await request.json();

  const [charge] = await sql`
    SELECT c.id FROM charges c
    JOIN expenses e ON e.id = c.expense_id
    WHERE c.id = ${chargeId} AND c.expense_id = ${expenseId}
    AND (e.user_id = ${session.userId} OR c.person_user_id = ${session.userId})
  `;
  if (!charge) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

  await sql`UPDATE charges SET paid = ${paid} WHERE id = ${chargeId}`;
  return NextResponse.json({ success: true });
}
