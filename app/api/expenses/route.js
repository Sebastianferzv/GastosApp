import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import sql from '@/lib/db';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const expenses = await sql`
    SELECT e.id, e.name, e.total::float, e.date, e.my_share::float, e.month,
      COALESCE(json_agg(
        json_build_object(
          'id', c.id, 'person', c.person_name,
          'personUserId', c.person_user_id,
          'amount', (c.amount - COALESCE(c.paid_amount, 0))::float,
          'paidAmount', COALESCE(c.paid_amount, 0)::float,
          'paid', c.paid
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
  })));
}

export async function POST(request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { name, total, date, myShare, month, charges } = await request.json();
  const [expense] = await sql`
    INSERT INTO expenses (user_id, name, total, date, my_share, month)
    VALUES (${session.userId}, ${name}, ${total}, ${date}, ${myShare}, ${month})
    RETURNING id
  `;

  const [creator] = await sql`SELECT display_name FROM users WHERE id = ${session.userId}`;

  for (const c of charges || []) {
    await sql`
      INSERT INTO charges (expense_id, person_name, person_user_id, amount)
      VALUES (${expense.id}, ${c.person}, ${c.personUserId || null}, ${c.amount})
    `;
    if (c.personUserId) {
      await sql`
        INSERT INTO notifications (user_id, type, message, from_user_id, reference_id)
        VALUES (${c.personUserId}, 'expense_added', ${`${creator.display_name} te agregó al gasto "${name}"`}, ${session.userId}, ${expense.id})
      `;
    }
  }

  return NextResponse.json({ id: expense.id });
}
