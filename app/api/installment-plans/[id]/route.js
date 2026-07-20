import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import sql from '@/lib/db';

export async function GET(request, { params }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { id } = await params;
  const [plan] = await sql`SELECT * FROM installment_plans WHERE id = ${id} AND user_id = ${session.userId}`;
  if (!plan) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

  const rows = await sql`
    SELECT e.id,
      COALESCE(json_agg(json_build_object('paid', c.paid)) FILTER (WHERE c.id IS NOT NULL), '[]') as charges
    FROM expenses e
    LEFT JOIN charges c ON c.expense_id = e.id
    WHERE e.installment_plan_id = ${id}
    GROUP BY e.id
  `;
  const paidCount = rows.filter(r => r.charges.length === 0 || r.charges.every(c => c.paid)).length;

  return NextResponse.json({
    id: plan.id,
    name: plan.name,
    monthlyAmount: Number(plan.monthly_amount),
    totalCount: plan.total_count,
    createdCount: plan.created_count,
    paidCount,
  });
}

export async function PUT(request, { params }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { id } = await params;
  const [plan] = await sql`SELECT * FROM installment_plans WHERE id = ${id} AND user_id = ${session.userId}`;
  if (!plan) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

  const { monthlyAmount, totalCount } = await request.json();
  if (!monthlyAmount || monthlyAmount <= 0) return NextResponse.json({ error: 'El monto mensual debe ser mayor a 0.' }, { status: 400 });
  if (!totalCount || totalCount < plan.created_count) {
    return NextResponse.json({ error: `No puede ser menor a las ${plan.created_count} cuotas ya creadas.` }, { status: 400 });
  }
  if (totalCount > 60) return NextResponse.json({ error: 'Máximo 60 cuotas.' }, { status: 400 });

  await sql`UPDATE installment_plans SET monthly_amount = ${monthlyAmount}, total_count = ${totalCount} WHERE id = ${id}`;

  return NextResponse.json({ ok: true });
}
