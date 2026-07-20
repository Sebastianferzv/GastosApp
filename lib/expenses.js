import sql from './db';

export async function createExpenseWithCharges({ userId, name, total, date, myShare, month, charges }) {
  const [expense] = await sql`
    INSERT INTO expenses (user_id, name, total, date, my_share, month)
    VALUES (${userId}, ${name}, ${total}, ${date}, ${myShare}, ${month})
    RETURNING id
  `;

  const [creator] = await sql`SELECT display_name FROM users WHERE id = ${userId}`;

  for (const c of charges || []) {
    await sql`
      INSERT INTO charges (expense_id, person_name, person_user_id, amount)
      VALUES (${expense.id}, ${c.person}, ${c.personUserId || null}, ${c.amount})
    `;
    if (c.personUserId) {
      await sql`
        INSERT INTO notifications (user_id, type, message, from_user_id, reference_id)
        VALUES (${c.personUserId}, 'expense_added', ${`${creator.display_name} te agregó al gasto "${name}"`}, ${userId}, ${expense.id})
      `;
    }
  }

  return expense.id;
}
