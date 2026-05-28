import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getSession } from '@/lib/auth';
import sql from '@/lib/db';

export async function PUT(request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { displayName, avatarUrl, currentPassword, newPassword } = await request.json();

  if (newPassword !== undefined) {
    if (!currentPassword || !newPassword)
      return NextResponse.json({ error: 'Faltan campos para cambiar contraseña' }, { status: 400 });
    if (newPassword.length < 6)
      return NextResponse.json({ error: 'La nueva contraseña debe tener al menos 6 caracteres' }, { status: 400 });

    const [user] = await sql`SELECT password_hash FROM users WHERE id = ${session.userId}`;
    const valid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!valid)
      return NextResponse.json({ error: 'Contraseña actual incorrecta' }, { status: 400 });

    const newHash = await bcrypt.hash(newPassword, 10);
    await sql`UPDATE users SET password_hash = ${newHash} WHERE id = ${session.userId}`;
    return NextResponse.json({ success: true });
  }

  if (displayName !== undefined) {
    const name = displayName.trim();
    if (!name) return NextResponse.json({ error: 'El nombre no puede estar vacío' }, { status: 400 });
    await sql`UPDATE users SET display_name = ${name} WHERE id = ${session.userId}`;
  }

  if (avatarUrl !== undefined) {
    await sql`UPDATE users SET avatar_url = ${avatarUrl} WHERE id = ${session.userId}`;
  }

  const [updated] = await sql`SELECT id, username, display_name, avatar_url FROM users WHERE id = ${session.userId}`;
  return NextResponse.json({ success: true, user: { id: updated.id, username: updated.username, displayName: updated.display_name, avatarUrl: updated.avatar_url } });
}
