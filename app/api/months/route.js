import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import sql from '@/lib/db';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const fromExpenses = await sql`
    SELECT DISTINCT month FROM expenses WHERE user_id = ${session.userId}
  `;
  const manual = await sql`
    SELECT month FROM user_months WHERE user_id = ${session.userId}
  `;

  const all = [...new Set([...fromExpenses.map(r => r.month), ...manual.map(r => r.month)])];
  all.sort().reverse();
  return NextResponse.json(all);
}

export async function POST(request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  const { month } = await request.json();
  await sql`INSERT INTO user_months (user_id, month) VALUES (${session.userId}, ${month}) ON CONFLICT DO NOTHING`;
  return NextResponse.json({ success: true });
}
