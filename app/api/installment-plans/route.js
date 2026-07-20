import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import sql from '@/lib/db';
import { processDuePlan } from '@/lib/installments';

export async function POST(request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { name, monthlyAmount, totalCount, startMonth, dayOfMonth, myShare, charges } = await request.json();

  if (!name?.trim()) return NextResponse.json({ error: 'Ingresa el nombre del gasto.' }, { status: 400 });
  if (!monthlyAmount || monthlyAmount <= 0) return NextResponse.json({ error: 'El monto mensual debe ser mayor a 0.' }, { status: 400 });
  if (!totalCount || totalCount < 1 || totalCount > 60) return NextResponse.json({ error: 'Número de cuotas inválido (1-60).' }, { status: 400 });
  if (!startMonth || !dayOfMonth) return NextResponse.json({ error: 'Falta el mes o día de inicio.' }, { status: 400 });
  if (startMonth < new Date().toISOString().slice(0, 7)) return NextResponse.json({ error: 'El mes de inicio no puede ser anterior al mes actual.' }, { status: 400 });

  const [plan] = await sql`
    INSERT INTO installment_plans (user_id, name, monthly_amount, my_share, charges, total_count, created_count, next_month, day_of_month)
    VALUES (${session.userId}, ${name.trim()}, ${monthlyAmount}, ${myShare}, ${JSON.stringify(charges || [])}, ${totalCount}, 0, ${startMonth}, ${dayOfMonth})
    RETURNING *
  `;

  await processDuePlan(plan, startMonth); // crea la cuota 1 ahora mismo

  return NextResponse.json({ id: plan.id });
}
