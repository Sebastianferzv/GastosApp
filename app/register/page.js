'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ username: '', password: '', displayName: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true); setError('');
    const res = await fetch('/api/auth/register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (res.ok) router.push('/gastos');
    else { setError(data.error); setLoading(false); }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div className="card" style={{ width: '100%', maxWidth: '360px' }}>
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{ fontSize: '2.2rem', marginBottom: '10px' }}>💰</div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 700, background: 'var(--grad)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Crear cuenta
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '.83rem', marginTop: '6px' }}>Gastos y Cobros</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '12px' }}>
            <label style={{ fontSize: '.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '5px' }}>Nombre para mostrar</label>
            <input type="text" placeholder="Tu nombre" value={form.displayName}
              onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))} required />
          </div>
          <div style={{ marginBottom: '12px' }}>
            <label style={{ fontSize: '.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '5px' }}>
              Usuario <span style={{ color: 'var(--text-muted)', fontSize: '.75rem' }}>(sin espacios)</span>
            </label>
            <input type="text" placeholder="ej: juan123" value={form.username}
              onChange={e => setForm(f => ({ ...f, username: e.target.value.toLowerCase().replace(/\s/g, '') }))}
              required autoComplete="username" />
          </div>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ fontSize: '.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '5px' }}>
              Contraseña <span style={{ color: 'var(--text-muted)', fontSize: '.75rem' }}>(mín. 6 caracteres)</span>
            </label>
            <input type="password" placeholder="••••••••" value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required autoComplete="new-password" />
          </div>
          {error && <p style={{ color: 'var(--red)', fontSize: '.83rem', marginBottom: '12px', textAlign: 'center' }}>{error}</p>}
          <button className="btn-primary" type="submit" disabled={loading} style={{ width: '100%' }}>
            {loading ? 'Creando cuenta...' : 'Crear cuenta'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '18px', fontSize: '.83rem', color: 'var(--text-muted)' }}>
          ¿Ya tenés cuenta?{' '}
          <Link href="/login" style={{ color: 'var(--gold2)', textDecoration: 'none', fontWeight: 600 }}>Iniciar sesión</Link>
        </p>
      </div>
    </div>
  );
}
