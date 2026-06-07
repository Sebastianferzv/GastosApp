'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';

// ── Avatar helper ──────────────────────────────────────────────────────────────
function UserAvatar({ user, size = 32 }) {
  if (user?.avatarUrl) {
    return <img src={user.avatarUrl} alt="" style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(201,154,20,.5)', flexShrink: 0 }} />;
  }
  const initials = (user?.displayName || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: 'linear-gradient(135deg,#c99a14,#e8b83c)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.35, fontWeight: 700, color: '#0e0b00', border: '2px solid rgba(201,154,20,.5)', flexShrink: 0, userSelect: 'none' }}>
      {initials}
    </div>
  );
}

function relativeTime(ts) {
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'ahora';
  if (m < 60) return `hace ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h}h`;
  return `hace ${Math.floor(h / 24)}d`;
}

// ── Helpers ────────────────────────────────────────────────────────────────────
const MONTHS_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio',
  'Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

function todayISO() { return new Date().toISOString().slice(0, 10); }
function fmtDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}
function fmtMonth(yyyymm) {
  if (!yyyymm) return '';
  const [y, m] = yyyymm.split('-');
  return `${MONTHS_ES[parseInt(m) - 1]} ${y}`;
}
function fmt(n) { return Math.round(Number(n)).toLocaleString('es-CL'); }

function loadContacts() {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem('contactos') || '[]'); } catch { return []; }
}
function saveContacts(c) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('contactos', JSON.stringify(c));
}

// ── Toast component ────────────────────────────────────────────────────────────
function Toast({ toast }) {
  if (!toast) return null;
  const colors = {
    success: { background: 'linear-gradient(135deg,rgba(52,211,153,.95),rgba(16,185,129,.95))', color: '#022c22' },
    danger:  { background: 'rgba(239,68,68,.92)', color: '#fff' },
    info:    { background: 'rgba(201,154,20,.92)', color: '#0e0b00' },
  };
  return (
    <div className="toast" style={{ ...colors[toast.type], fontWeight: 600 }}>
      {toast.msg}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function GastosPage() {
  const router = useRouter();

  // Auth
  const [user, setUser] = useState(null);

  // Data
  const [expenses, setExpenses] = useState([]);
  const [months, setMonths] = useState([]);
  const [friends, setFriends] = useState([]);
  const [incoming, setIncoming] = useState([]);
  const [contacts, setContacts] = useState([]);

  // UI state
  const [activeTab, setActiveTab] = useState('gastos'); // 'gastos' | 'cobran'
  const [selectedMonth, setSelectedMonth] = useState(todayISO().slice(0, 7));
  const [filterPending, setFilterPending] = useState(true);
  const [filterIncomingPending, setFilterIncomingPending] = useState(true);

  // Form (add expense)
  const [formName, setFormName] = useState('');
  const [formTotal, setFormTotal] = useState('');
  const [formDate, setFormDate] = useState(todayISO());
  const [selectedPeople, setSelectedPeople] = useState([]);
  const [panelOpen, setPanelOpen] = useState(false);
  const peopleWrapRef = useRef(null);

  // Edit expense
  const [editingId, setEditingId] = useState(null);
  const [editingTab, setEditingTab] = useState('monto');
  const [editName, setEditName] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editTotal, setEditTotal] = useState(0);
  const [editAmounts, setEditAmounts] = useState({});
  const [editPercents, setEditPercents] = useState({});
  const [editBaseAmts, setEditBaseAmts] = useState({});
  const [editPreAmts, setEditPreAmts] = useState({});
  const [editTipPct, setEditTipPct] = useState(10);
  const [lockedKeys, setLockedKeys] = useState(new Set());

  // Completing animations
  const completingExpenses = useRef(new Set());
  const [, forceUpdate] = useState(0);

  // Modals
  const [showAddMonth, setShowAddMonth] = useState(false);
  const [addMonthVal, setAddMonthVal] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null); // {id, name}
  const [showResumen, setShowResumen] = useState(false);
  const [showFriends, setShowFriends] = useState(false);
  const [showAddPerson, setShowAddPerson] = useState(false);
  const [addPersonVal, setAddPersonVal] = useState('');
  const [showMarkAllConfirm, setShowMarkAllConfirm] = useState(false);
  const [markAllTarget, setMarkAllTarget] = useState(null); // {name, idx}
  const [showAbout, setShowAbout] = useState(false);
  const [showRevertConfirm, setShowRevertConfirm] = useState(false);
  const [revertTarget, setRevertTarget] = useState(null); // incoming item
  const [completingResumen, setCompletingResumen] = useState(new Set());
  const [showPartialModal, setShowPartialModal] = useState(false);
  const [partialTarget, setPartialTarget] = useState(null);
  const [partialAmountStr, setPartialAmountStr] = useState('');

  // Friends modal
  const [friendSearch, setFriendSearch] = useState('');
  const [friendSearchError, setFriendSearchError] = useState('');
  const [newContactName, setNewContactName] = useState('');

  // Toast
  const [toastState, setToastState] = useState(null);
  const toastTimer = useRef(null);

  // User menu & profile
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [profileTab, setProfileTab] = useState('avatar');
  const [profileDisplayName, setProfileDisplayName] = useState('');
  const [profileCurrentPwd, setProfileCurrentPwd] = useState('');
  const [profileNewPwd, setProfileNewPwd] = useState('');
  const [profileError, setProfileError] = useState('');
  const userMenuRef = useRef(null);
  const avatarInputRef = useRef(null);

  // Notifications
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const notifMenuRef = useRef(null);

  // iOS detection
  const [isIOS, setIsIOS] = useState(false);
  useEffect(() => {
    setIsIOS(/iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream);
  }, []);

  function showToast(msg, type = 'info') {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToastState({ msg, type });
    toastTimer.current = setTimeout(() => setToastState(null), 2500);
  }

  // ── Fetch helpers ────────────────────────────────────────────────────────────
  const fetchExpenses = useCallback(async () => {
    const res = await fetch('/api/expenses');
    if (res.ok) setExpenses(await res.json());
  }, []);

  const fetchMonths = useCallback(async () => {
    const res = await fetch('/api/months');
    if (res.ok) {
      const data = await res.json();
      setMonths(data);
      return data;
    }
    return [];
  }, []);

  const fetchFriends = useCallback(async () => {
    const res = await fetch('/api/friends');
    if (res.ok) setFriends(await res.json());
  }, []);

  const fetchIncoming = useCallback(async () => {
    const res = await fetch('/api/incoming');
    if (res.ok) setIncoming(await res.json());
  }, []);

  const fetchNotifications = useCallback(async () => {
    const res = await fetch('/api/notifications');
    if (res.ok) setNotifications(await res.json());
  }, []);

  // ── Init ─────────────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const res = await fetch('/api/auth/me');
      if (!res.ok) { router.push('/login'); return; }
      const me = await res.json();
      setUser(me);

      setContacts(loadContacts());

      const [, mData] = await Promise.all([fetchExpenses(), fetchMonths()]);
      await Promise.all([fetchFriends(), fetchIncoming(), fetchNotifications()]);

      if (mData && mData.length > 0) {
        const today = todayISO().slice(0, 7);
        setSelectedMonth(mData.includes(today) ? today : mData[mData.length - 1]);
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Ensure current month exists
  useEffect(() => {
    if (months.length > 0 && !months.includes(selectedMonth)) {
      setSelectedMonth(months[months.length - 1]);
    }
  }, [months, selectedMonth]);

  // Close people panel and dropdowns on outside click
  useEffect(() => {
    function handleMouseDown(e) {
      if (peopleWrapRef.current && !peopleWrapRef.current.contains(e.target)) setPanelOpen(false);
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) setShowUserMenu(false);
      if (notifMenuRef.current && !notifMenuRef.current.contains(e.target)) setShowNotifications(false);
    }
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, []);

  // Poll notifications every 30s
  useEffect(() => {
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // ── Logout ───────────────────────────────────────────────────────────────────
  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  // ── Profile actions ──────────────────────────────────────────────────────────
  async function updateDisplayName() {
    const name = profileDisplayName.trim();
    if (!name) return;
    const res = await fetch('/api/auth/profile', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: name }),
    });
    const data = await res.json();
    if (!res.ok) { setProfileError(data.error); return; }
    setUser(prev => ({ ...prev, displayName: data.user.displayName }));
    setProfileError('');
    showToast('Nombre actualizado.', 'success');
  }

  async function updatePassword() {
    const res = await fetch('/api/auth/profile', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword: profileCurrentPwd, newPassword: profileNewPwd }),
    });
    const data = await res.json();
    if (!res.ok) { setProfileError(data.error); return; }
    setProfileCurrentPwd(''); setProfileNewPwd(''); setProfileError('');
    showToast('Contraseña actualizada.', 'success');
  }

  function handleAvatarChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const img = new Image();
    const reader = new FileReader();
    reader.onload = (ev) => {
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX = 200;
        let w = img.width, h = img.height;
        if (w > h) { if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; } }
        else { if (h > MAX) { w = Math.round(w * MAX / h); h = MAX; } }
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        uploadAvatar(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  async function uploadAvatar(dataUrl) {
    const res = await fetch('/api/auth/profile', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ avatarUrl: dataUrl }),
    });
    const data = await res.json();
    if (!res.ok) { showToast('Error al subir la foto.', 'danger'); return; }
    setUser(prev => ({ ...prev, avatarUrl: data.user.avatarUrl }));
    showToast('Foto actualizada.', 'success');
  }

  // ── Notifications ────────────────────────────────────────────────────────────
  async function markNotificationsRead(ids) {
    await fetch('/api/notifications/read', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    });
    setNotifications(prev => prev.map(n =>
      (!ids || ids.includes(n.id)) ? { ...n, read: true } : n
    ));
  }

  async function handleNotifAction(notifId, action) {
    const res = await fetch(`/api/notifications/${notifId}/action`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    if (res.ok) {
      setNotifications(prev => prev.map(n => n.id === notifId ? { ...n, read: true } : n));
      if (action === 'accept') {
        await Promise.all([fetchExpenses(), fetchIncoming()]);
        showToast('Pago confirmado.', 'success');
      } else {
        showToast('Solicitud rechazada.', 'info');
      }
    } else {
      const data = await res.json().catch(() => ({}));
      showToast(data.error || 'Error al procesar la solicitud.', 'danger');
    }
  }

  // ── Month management ─────────────────────────────────────────────────────────
  async function handleAddMonth() {
    if (!addMonthVal) return;
    await fetch('/api/months', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ month: addMonthVal }),
    });
    const data = await fetchMonths();
    setSelectedMonth(addMonthVal);
    setShowAddMonth(false);
    setAddMonthVal('');
  }

  // ── People panel ─────────────────────────────────────────────────────────────
  const acceptedFriends = friends.filter(f => f.status === 'accepted');

  function togglePersonInPanel(name, userId = null) {
    setSelectedPeople(prev => {
      const idx = prev.findIndex(p => p.name.toLowerCase() === name.toLowerCase());
      if (idx >= 0) return prev.filter((_, i) => i !== idx);
      return [...prev, { name, userId }];
    });
  }

  function removeChip(idx) {
    setSelectedPeople(prev => prev.filter((_, i) => i !== idx));
  }

  function handleOtroClick() {
    setPanelOpen(false);
    setAddPersonVal('');
    setShowAddPerson(true);
  }

  function saveNewPerson() {
    const name = addPersonVal.trim();
    if (!name) return;
    const list = loadContacts();
    if (!list.some(c => c.toLowerCase() === name.toLowerCase())) {
      list.push(name);
      list.sort((a, b) => a.localeCompare(b, 'es'));
      saveContacts(list);
      setContacts(list);
    }
    setSelectedPeople(prev => {
      if (prev.some(p => p.name.toLowerCase() === name.toLowerCase())) return prev;
      return [...prev, { name, userId: null }];
    });
    setShowAddPerson(false);
    showToast(`"${name}" agregado y seleccionado.`, 'success');
  }

  // ── Create expense ───────────────────────────────────────────────────────────
  async function createExpense() {
    const name = formName.trim();
    const total = parseFloat(formTotal);
    const date = formDate || todayISO();

    if (!name) return showToast('Ingresa el nombre del gasto.', 'danger');
    if (!total || total <= 0) return showToast('El monto debe ser mayor a 0.', 'danger');

    let myShare, charges;
    if (!selectedPeople.length) {
      myShare = total;
      charges = [];
    } else {
      const n = selectedPeople.length + 1;
      const base = Math.round(total / n * 100) / 100;
      const rem = Math.round((total - base * n) * 100) / 100;
      myShare = base;
      charges = selectedPeople.map((p, i) => ({
        person: p.name,
        personUserId: p.userId || null,
        amount: i === 0 ? Math.round((base + rem) * 100) / 100 : base,
      }));
    }

    const res = await fetch('/api/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, total, date, myShare, month: selectedMonth, charges }),
    });

    if (res.ok) {
      setFormName('');
      setFormTotal('');
      setFormDate(todayISO());
      setSelectedPeople([]);
      setPanelOpen(false);
      await fetchExpenses();
      showToast(`Gasto "${name}" creado.`, 'success');
    } else {
      const d = await res.json();
      showToast(d.error || 'Error al crear el gasto.', 'danger');
    }
  }

  // ── Toggle charge (paid/unpaid) ──────────────────────────────────────────────
  async function toggleCharge(expenseId, chargeId, currentPaid) {
    const newPaid = !currentPaid;
    const res = await fetch(`/api/charges/${expenseId}/${chargeId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paid: newPaid }),
    });
    if (!res.ok) { showToast('Error al actualizar.', 'danger'); return; }

    // Optimistic: check if expense will be fully paid
    const expense = expenses.find(e => e.id === expenseId);
    if (expense) {
      const updatedCharges = expense.charges.map(c => c.id === chargeId ? { ...c, paid: newPaid } : c);
      const justCompleted = newPaid && updatedCharges.length > 0 && updatedCharges.every(c => c.paid);
      if (justCompleted && filterPending) {
        completingExpenses.current.add(expenseId);
        forceUpdate(n => n + 1);
        // Apply completing class
        setTimeout(() => {
          const card = document.querySelector(`[data-expense-id="${expenseId}"]`);
          if (card) card.classList.add('completing');
        }, 0);
        setTimeout(async () => {
          completingExpenses.current.delete(expenseId);
          await fetchExpenses();
        }, 900);
        return;
      }
    }

    await fetchExpenses();
  }

  // ── Request payment confirmation (does NOT mark paid yet) ───────────────────
  const [pendingRequests, setPendingRequests] = useState(new Set());

  async function toggleIncomingPaid(expenseId, chargeId) {
    setPendingRequests(prev => new Set(prev).add(chargeId));
    const res = await fetch(`/api/charges/${expenseId}/${chargeId}/request`, { method: 'POST' });
    if (res.ok) {
      showToast('Solicitud enviada. Esperando confirmación.', 'info');
    } else {
      setPendingRequests(prev => { const s = new Set(prev); s.delete(chargeId); return s; });
      const data = await res.json();
      showToast(data.error || 'Error al enviar solicitud.', 'danger');
    }
  }

  async function cancelPaymentRequest(expenseId, chargeId) {
    const res = await fetch(`/api/charges/${expenseId}/${chargeId}/request`, { method: 'DELETE' });
    if (res.ok) {
      setPendingRequests(prev => { const s = new Set(prev); s.delete(chargeId); return s; });
      showToast('Solicitud cancelada.', 'info');
    }
  }

  async function revertIncomingPaid() {
    if (!revertTarget) return;
    const res = await fetch(`/api/charges/${revertTarget.expenseId}/${revertTarget.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paid: false }),
    });
    setShowRevertConfirm(false);
    setRevertTarget(null);
    if (res.ok) { await fetchIncoming(); showToast('Cobro revertido a pendiente.', 'info'); }
    else showToast('Error al revertir.', 'danger');
  }

  // ── Delete expense ───────────────────────────────────────────────────────────
  function openDeleteConfirm(id, name) {
    setDeleteTarget({ id, name });
    setShowDeleteConfirm(true);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const res = await fetch(`/api/expenses/${deleteTarget.id}`, { method: 'DELETE' });
    if (res.ok) {
      await fetchExpenses();
      showToast('Gasto eliminado.', 'info');
    } else showToast('Error al eliminar.', 'danger');
    setShowDeleteConfirm(false);
    setDeleteTarget(null);
  }

  // ── Edit expense ─────────────────────────────────────────────────────────────
  function startEdit(expense) {
    const allKeys = ['tu', ...expense.charges.map(c => String(c.id))];
    const n = allKeys.length;

    const amts = { tu: expense.myShare ?? 0 };
    expense.charges.forEach(c => { amts[String(c.id)] = c.amount; });

    const pcts = {};
    allKeys.forEach(k => {
      pcts[k] = Math.round((amts[k] || 0) / expense.total * 100 * 10) / 10;
    });
    const sumP = allKeys.reduce((s, k) => s + pcts[k], 0);
    pcts['tu'] = Math.round((pcts['tu'] + (100 - sumP)) * 10) / 10;

    const base0 = Math.round(expense.total / 1.1 * 100) / 100;
    const bp0 = Math.round(base0 / n * 100) / 100;
    const br0 = Math.round((base0 - bp0 * n) * 100) / 100;
    const baseAmts = {};
    allKeys.forEach((k, i) => { baseAmts[k] = i === 0 ? Math.round((bp0 + br0) * 100) / 100 : bp0; });

    const preAmts = {};
    allKeys.forEach(k => { preAmts[k] = amts[k] || 0; });

    setEditingId(expense.id);
    setEditName(expense.name);
    setEditDate(expense.date || todayISO());
    setEditTotal(expense.total);
    setEditingTab('monto');
    setEditAmounts(amts);
    setEditPercents(pcts);
    setEditBaseAmts(baseAmts);
    setEditPreAmts(preAmts);
    setEditTipPct(10);
    setLockedKeys(new Set());
  }

  function cancelEdit() {
    setEditingId(null);
    setEditAmounts({});
    setEditPercents({});
    setEditBaseAmts({});
    setEditPreAmts({});
    setLockedKeys(new Set());
    setEditTotal(0);
    setEditingTab('monto');
  }

  async function saveEdit(expense) {
    const name = editName.trim();
    if (!name) return showToast('El nombre no puede estar vacío.', 'danger');
    const allKeys = ['tu', ...expense.charges.map(c => String(c.id))];
    const newTotal = editTotal || expense.total;
    let newMyShare, newCharges;

    if (editingTab === 'monto') {
      const sumEdit = allKeys.reduce((s, k) => s + (editAmounts[k] || 0), 0);
      if (Math.abs(sumEdit - newTotal) > 0.05) return showToast('La distribución no suma el total.', 'danger');
      newMyShare = editAmounts['tu'] || 0;
      newCharges = expense.charges.map(c => ({
        ...c, amount: editAmounts[String(c.id)] || 0,
      }));
    } else if (editingTab === 'porcentaje') {
      const sumPct = allKeys.reduce((s, k) => s + (editPercents[k] || 0), 0);
      if (Math.abs(sumPct - 100) > 0.6) return showToast('Los porcentajes no suman 100%.', 'danger');
      let chargeSum = 0;
      newCharges = expense.charges.map(c => {
        const amt = Math.round(newTotal * (editPercents[String(c.id)] || 0) / 100 * 100) / 100;
        chargeSum += amt;
        return { ...c, amount: amt };
      });
      newMyShare = Math.round((newTotal - chargeSum) * 100) / 100;
    } else if (editingTab === 'propina') {
      const base = newTotal / (1 + editTipPct / 100);
      const sumBase = allKeys.reduce((s, k) => s + (editBaseAmts[k] || 0), 0);
      if (Math.abs(sumBase - base) > 1) return showToast('Las bases no suman el monto sin propina.', 'danger');
      let chargeSum = 0;
      newCharges = expense.charges.map(c => {
        const amt = Math.round((editBaseAmts[String(c.id)] || 0) * (1 + editTipPct / 100) * 100) / 100;
        chargeSum += amt;
        return { ...c, amount: amt };
      });
      newMyShare = Math.round((newTotal - chargeSum) * 100) / 100;
    } else if (editingTab === 'descuento') {
      const preTotal = allKeys.reduce((s, k) => s + (editPreAmts[k] || 0), 0);
      if (preTotal <= newTotal + 0.01) return showToast('La suma sin descuento debe ser mayor al total final.', 'danger');
      const discFactor = newTotal / preTotal;
      let chargeSum = 0;
      newCharges = expense.charges.map(c => {
        const amt = Math.round((editPreAmts[String(c.id)] || 0) * discFactor * 100) / 100;
        chargeSum += amt;
        return { ...c, amount: amt };
      });
      newMyShare = Math.round((newTotal - chargeSum) * 100) / 100;
    }

    const res = await fetch(`/api/expenses/${expense.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        date: editDate || expense.date,
        total: newTotal,
        myShare: newMyShare,
        charges: newCharges,
      }),
    });
    if (res.ok) {
      cancelEdit();
      await fetchExpenses();
      showToast('Gasto actualizado.', 'success');
    } else {
      showToast('Error al guardar.', 'danger');
    }
  }

  // ── Edit tab switch ──────────────────────────────────────────────────────────
  function switchEditTab(tab, expense) {
    if (tab === editingTab) return;
    const allKeys = ['tu', ...expense.charges.map(c => String(c.id))];
    const n = allKeys.length;
    const total = editTotal || expense.total;

    if (tab === 'porcentaje') {
      const pcts = {};
      allKeys.forEach(k => {
        pcts[k] = Math.round((editAmounts[k] || 0) / total * 100 * 10) / 10;
      });
      const sp = allKeys.reduce((s, k) => s + pcts[k], 0);
      pcts['tu'] = Math.round((pcts['tu'] + (100 - sp)) * 10) / 10;
      setEditPercents(pcts);
    } else if (tab === 'propina') {
      const base = Math.round(total / (1 + editTipPct / 100) * 100) / 100;
      const bp = Math.round(base / n * 100) / 100;
      const br = Math.round((base - bp * n) * 100) / 100;
      const baseAmts = {};
      allKeys.forEach((k, i) => { baseAmts[k] = i === 0 ? Math.round((bp + br) * 100) / 100 : bp; });
      setEditBaseAmts(baseAmts);
    } else if (tab === 'descuento') {
      const preAmts = {};
      allKeys.forEach(k => { preAmts[k] = editAmounts[k] || 0; });
      setEditPreAmts(preAmts);
    }
    setLockedKeys(new Set());
    setEditingTab(tab);
  }

  // ── Edit amount change (monto tab) ───────────────────────────────────────────
  function handleEditAmount(key, rawVal, expense) {
    const total = editTotal || expense.total;
    const val = Math.max(0, Math.min(parseFloat(rawVal) || 0, total));
    const allKeys = ['tu', ...expense.charges.map(c => String(c.id))];
    const fixedSet = new Set([key, ...lockedKeys]);
    const toUpdate = allKeys.filter(k => !fixedSet.has(k));
    const fixedSum = allKeys.filter(k => fixedSet.has(k)).reduce((s, k) => s + (k === key ? val : (editAmounts[k] || 0)), 0);
    const remaining = Math.max(0, total - fixedSum);

    const newAmts = { ...editAmounts, [key]: val };
    if (toUpdate.length > 0) {
      const base = Math.round(remaining / toUpdate.length * 100) / 100;
      const rem = Math.round((remaining - base * toUpdate.length) * 100) / 100;
      toUpdate.forEach((k, i) => {
        newAmts[k] = i === 0 ? Math.round((base + rem) * 100) / 100 : base;
      });
    }
    setEditAmounts(newAmts);
  }

  // ── Edit percent change ──────────────────────────────────────────────────────
  function handleEditPercent(key, rawVal, expense) {
    const val = Math.max(0, Math.min(100, parseFloat(rawVal) || 0));
    const allKeys = ['tu', ...expense.charges.map(c => String(c.id))];
    const fixedSet = new Set([key, ...lockedKeys]);
    const toUpdate = allKeys.filter(k => !fixedSet.has(k));
    const fixedSum = allKeys.filter(k => fixedSet.has(k)).reduce((s, k) => s + (k === key ? val : (editPercents[k] || 0)), 0);
    const remaining = Math.max(0, 100 - fixedSum);

    const newPcts = { ...editPercents, [key]: val };
    if (toUpdate.length > 0) {
      const base = Math.round(remaining / toUpdate.length * 10) / 10;
      const rem = Math.round((remaining - base * toUpdate.length) * 10) / 10;
      toUpdate.forEach((k, i) => {
        newPcts[k] = i === 0 ? Math.round((base + rem) * 10) / 10 : base;
      });
    }
    setEditPercents(newPcts);
  }

  // ── Edit base amount (propina tab) ───────────────────────────────────────────
  function handleEditBaseAmt(key, rawVal, expense) {
    const total = editTotal || expense.total;
    const base = Math.round(total / (1 + editTipPct / 100) * 100) / 100;
    const val = Math.max(0, Math.min(parseFloat(rawVal) || 0, base));
    const allKeys = ['tu', ...expense.charges.map(c => String(c.id))];
    const fixedSet = new Set([key, ...lockedKeys]);
    const toUpdate = allKeys.filter(k => !fixedSet.has(k));
    const fixedSum = allKeys.filter(k => fixedSet.has(k)).reduce((s, k) => s + (k === key ? val : (editBaseAmts[k] || 0)), 0);
    const remaining = Math.max(0, base - fixedSum);

    const newBaseAmts = { ...editBaseAmts, [key]: val };
    if (toUpdate.length > 0) {
      const bp = Math.round(remaining / toUpdate.length * 100) / 100;
      const br = Math.round((remaining - bp * toUpdate.length) * 100) / 100;
      toUpdate.forEach((k, i) => {
        newBaseAmts[k] = i === 0 ? Math.round((bp + br) * 100) / 100 : bp;
      });
    }
    setEditBaseAmts(newBaseAmts);
  }

  // ── Edit pre-discount amounts ────────────────────────────────────────────────
  function handleEditPreAmt(key, rawVal) {
    const val = Math.max(0, parseFloat(rawVal) || 0);
    setEditPreAmts(prev => ({ ...prev, [key]: val }));
  }

  // ── Update tip pct ───────────────────────────────────────────────────────────
  function handleTipPct(rawVal, expense) {
    const pct = Math.max(0, Math.min(99, parseFloat(rawVal) || 0));
    setEditTipPct(pct);
    const total = editTotal || expense.total;
    const base = Math.round(total / (1 + pct / 100) * 100) / 100;
    const allKeys = ['tu', ...expense.charges.map(c => String(c.id))];
    const n = allKeys.length;
    const bp = Math.round(base / n * 100) / 100;
    const br = Math.round((base - bp * n) * 100) / 100;
    const newBaseAmts = {};
    allKeys.forEach((k, i) => { newBaseAmts[k] = i === 0 ? Math.round((bp + br) * 100) / 100 : bp; });
    setEditBaseAmts(newBaseAmts);
  }

  // ── Update edit total ────────────────────────────────────────────────────────
  function handleEditTotalChange(rawVal, expense) {
    const val = Math.max(1, parseFloat(rawVal) || 0);
    setEditTotal(val);
    const allKeys = ['tu', ...expense.charges.map(c => String(c.id))];
    const n = allKeys.length;
    const bm = Math.round(val / n * 100) / 100;
    const rm = Math.round((val - bm * n) * 100) / 100;
    const newAmts = {};
    allKeys.forEach((k, i) => { newAmts[k] = i === 0 ? Math.round((bm + rm) * 100) / 100 : bm; });
    setEditAmounts(newAmts);
    setLockedKeys(new Set());

    const base2 = Math.round(val / (1 + editTipPct / 100) * 100) / 100;
    const bpp = Math.round(base2 / n * 100) / 100;
    const brr = Math.round((base2 - bpp * n) * 100) / 100;
    const newBaseAmts = {};
    allKeys.forEach((k, i) => { newBaseAmts[k] = i === 0 ? Math.round((bpp + brr) * 100) / 100 : bpp; });
    setEditBaseAmts(newBaseAmts);
  }

  function toggleLock(key) {
    setLockedKeys(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  // ── Resumen ──────────────────────────────────────────────────────────────────
  function buildResumenData() {
    const byKey = {};
    const getOrCreate = (key, name, userId) => {
      if (!byKey[key]) byKey[key] = { name, userId, owesYou: [], youOwe: [] };
      return byKey[key];
    };
    expenses.forEach(e => {
      e.charges.forEach(c => {
        if (c.paid) return;
        const key = c.personUserId ? `u${c.personUserId}` : `n${c.person}`;
        const entry = getOrCreate(key, c.person, c.personUserId || null);
        if ((c.paidAmount || 0) > 0.01) {
          entry.owesYou.push({ expenseName: e.name, amount: c.paidAmount, date: e.date, expenseId: e.id, chargeId: c.id, isPartialPaid: true });
          entry.owesYou.push({ expenseName: e.name, amount: parseFloat((c.amount - c.paidAmount).toFixed(2)), date: e.date, expenseId: e.id, chargeId: c.id });
        } else {
          entry.owesYou.push({ expenseName: e.name, amount: c.amount, date: e.date, expenseId: e.id, chargeId: c.id });
        }
      });
    });
    incoming.forEach(item => {
      if (item.paid) return;
      const key = item.fromUserId ? `u${item.fromUserId}` : `n${item.fromName}`;
      const entry = getOrCreate(key, item.fromName, item.fromUserId || null);
      if ((item.paidAmount || 0) > 0.01) {
        entry.youOwe.push({ expenseName: item.expenseName, amount: item.paidAmount, date: item.date, expenseId: item.expenseId, chargeId: item.id, isPartialPaid: true });
        entry.youOwe.push({ expenseName: item.expenseName, amount: parseFloat((item.amount - item.paidAmount).toFixed(2)), date: item.date, expenseId: item.expenseId, chargeId: item.id });
      } else {
        entry.youOwe.push({ expenseName: item.expenseName, amount: item.amount, date: item.date, expenseId: item.expenseId, chargeId: item.id });
      }
    });
    return Object.values(byKey)
      .filter(e => {
        const net = e.owesYou.filter(r => !r.isPartialPaid).reduce((s, r) => s + r.amount, 0)
                  - e.youOwe.filter(r => !r.isPartialPaid).reduce((s, r) => s + r.amount, 0);
        return net !== 0;
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }

  async function handleMarkAllPaid(entry) {
    const effectiveOwesYou = entry.owesYou.filter(r => !r.isPartialPaid);
    const effectiveYouOwe = entry.youOwe.filter(r => !r.isPartialPaid);
    const totalOwesYou = effectiveOwesYou.reduce((s, r) => s + r.amount, 0);
    const totalYouOwe = effectiveYouOwe.reduce((s, r) => s + r.amount, 0);
    const net = totalOwesYou - totalYouOwe;

    setCompletingResumen(prev => new Set([...prev, entry.name]));
    setTimeout(async () => {
      // Always mark what they owe you as paid immediately
      await Promise.all(effectiveOwesYou.map(r =>
        fetch(`/api/charges/${r.expenseId}/${r.chargeId}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paid: true }),
        })
      ));

      if (net >= 0) {
        // They owe you more → mark your debts to them as paid directly too
        await Promise.all(effectiveYouOwe.map(r =>
          fetch(`/api/charges/${r.expenseId}/${r.chargeId}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ paid: true }),
          })
        ));
      } else {
        // You owe them more → send payment request notifications
        await Promise.all(effectiveYouOwe.map(r =>
          fetch(`/api/charges/${r.expenseId}/${r.chargeId}/request`, { method: 'POST' })
        ));
        showToast('Solicitudes enviadas. Esperando confirmación.', 'info');
      }

      setCompletingResumen(prev => { const n = new Set(prev); n.delete(entry.name); return n; });
      await Promise.all([fetchExpenses(), fetchIncoming()]);
    }, 900);
  }

  async function handlePartialPayment(entry) {
    const totalPay = parseFloat(partialAmountStr.replace(',', '.'));
    if (!totalPay || totalPay <= 0) return;

    const sorted = [...entry.youOwe.filter(r => !r.isPartialPaid)].sort((a, b) => (a.date < b.date ? -1 : 1));
    let remaining = totalPay;
    const payments = [];
    for (const item of sorted) {
      if (remaining < 0.01) break;
      const pay = parseFloat(Math.min(remaining, item.amount).toFixed(2));
      payments.push({ expenseId: item.expenseId, chargeId: item.chargeId, requestedAmount: pay });
      remaining = parseFloat((remaining - pay).toFixed(2));
    }

    setShowPartialModal(false);
    setPartialAmountStr('');

    const res = await fetch('/api/charges/partial', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payments }),
    });

    if (res.ok) {
      setPendingRequests(prev => {
        const s = new Set(prev);
        payments.forEach(p => s.add(p.chargeId));
        return s;
      });
      showToast('Solicitud enviada. Esperando confirmación.', 'info');
    } else {
      showToast('Error al enviar solicitud.', 'danger');
    }
  }

  function copyResumen(entry) {
    const effectiveOwesYou = entry.owesYou.filter(r => !r.isPartialPaid);
    const effectiveYouOwe = entry.youOwe.filter(r => !r.isPartialPaid);
    const totalOwesYou = effectiveOwesYou.reduce((s, r) => s + r.amount, 0);
    const totalYouOwe = effectiveYouOwe.reduce((s, r) => s + r.amount, 0);
    const net = totalOwesYou - totalYouOwe;
    const lines = [];
    if (effectiveOwesYou.length > 0) {
      lines.push('Me debes:');
      effectiveOwesYou.forEach(r => lines.push(`  +$${fmt(r.amount)} ${r.expenseName}`));
    }
    if (effectiveYouOwe.length > 0) {
      lines.push('Debo:');
      effectiveYouOwe.forEach(r => lines.push(`  -$${fmt(r.amount)} ${r.expenseName}`));
    }
    lines.push(`\nTotal: ${net >= 0 ? '+' : '-'}$${fmt(Math.abs(net))} (${net >= 0 ? 'me debes' : 'debo'})`);
    navigator.clipboard.writeText(lines.join('\n')).then(() => showToast('Copiado al portapapeles.', 'success'));
  }

  // ── Friends management ───────────────────────────────────────────────────────
  async function sendFriendRequest() {
    if (!friendSearch.trim()) return;
    setFriendSearchError('');
    const res = await fetch('/api/friends', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: friendSearch.trim() }),
    });
    const data = await res.json();
    if (res.ok) {
      setFriendSearch('');
      await fetchFriends();
      showToast('Solicitud enviada.', 'success');
    } else {
      setFriendSearchError(data.error || 'Error al enviar solicitud.');
    }
  }

  async function handleFriendAction(id, action) {
    await fetch(`/api/friends/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    await fetchFriends();
    showToast(action === 'accept' ? 'Solicitud aceptada.' : 'Solicitud rechazada.', action === 'accept' ? 'success' : 'info');
  }

  async function removeFriend(id) {
    await fetch(`/api/friends/${id}`, { method: 'DELETE' });
    await fetchFriends();
    showToast('Amigo eliminado.', 'info');
  }

  // ── Contacts ─────────────────────────────────────────────────────────────────
  function addContact() {
    const name = newContactName.trim();
    if (!name) return;
    const list = loadContacts();
    if (list.some(c => c.toLowerCase() === name.toLowerCase())) {
      showToast('Ese nombre ya existe.', 'info'); return;
    }
    list.push(name);
    list.sort((a, b) => a.localeCompare(b, 'es'));
    saveContacts(list);
    setContacts(list);
    setNewContactName('');
    showToast(`"${name}" agregado.`, 'success');
  }

  function removeContact(name) {
    const list = loadContacts().filter(c => c !== name);
    saveContacts(list);
    setContacts(list);
    setSelectedPeople(prev => prev.filter(p => p.name.toLowerCase() !== name.toLowerCase()));
    showToast(`"${name}" eliminado.`, 'info');
  }

  // ── Derived data ─────────────────────────────────────────────────────────────
  const filteredExpenses = expenses.filter(e => {
    if ((e.month || e.date?.slice(0, 7)) !== selectedMonth) return false;
    if (filterPending) {
      const allPaid = e.charges.length === 0 || e.charges.every(c => c.paid);
      if (allPaid && !completingExpenses.current.has(e.id)) return false;
    }
    return true;
  });

  const pendingIncomingCount = incoming.filter(i => !i.paid).length;

  const previewPeople = selectedPeople.length;
  const previewAmt = parseFloat(formTotal);
  const previewShare = previewAmt > 0 && previewPeople > 0
    ? Math.round(previewAmt / (previewPeople + 1))
    : null;

  const resumenData = buildResumenData();

  const pendingFriends = friends.filter(f => f.status === 'pending' && f.direction === 'received');
  const sentFriends = friends.filter(f => f.status === 'pending' && f.direction === 'sent');

  // ── Render: Edit tab content ─────────────────────────────────────────────────
  function renderEditTabContent(expense) {
    const total = editTotal || expense.total;
    const allKeys = ['tu', ...expense.charges.map(c => String(c.id))];
    const labels = { tu: 'Tú' };
    expense.charges.forEach(c => { labels[String(c.id)] = c.person; });

    if (editingTab === 'monto') {
      const sumEdit = allKeys.reduce((s, k) => s + (editAmounts[k] || 0), 0);
      const sumOk = Math.abs(sumEdit - total) < 0.05;
      return (
        <div>
          <p style={{ fontSize: '.78rem', color: 'var(--text-muted)', fontStyle: 'italic', marginBottom: 10 }}>
            Ingrese cuánto paga cada persona
          </p>
          {allKeys.map(k => {
            const locked = lockedKeys.has(k);
            return (
              <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ minWidth: 90, color: 'var(--text-muted)', fontSize: '.85rem', flexShrink: 0 }}>
                  {k === 'tu' && <i className="bi bi-person-fill" style={{ opacity: .35, marginRight: 4 }} />}
                  {labels[k]}
                </span>
                <div style={{ display: 'flex', flex: 1 }}>
                  <span style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRight: 'none', borderRadius: '8px 0 0 8px', padding: '6px 10px', fontSize: '.8rem', color: 'var(--text-muted)' }}>$</span>
                  <input type="number" value={editAmounts[k] ?? 0} min="0" step="1"
                    style={{ borderRadius: '0 8px 8px 0', borderLeft: 'none' }}
                    onChange={e => handleEditAmount(k, e.target.value, expense)} />
                </div>
                <button onClick={() => toggleLock(k)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, flexShrink: 0, color: locked ? '#e8b83c' : 'rgba(255,255,255,.18)' }}
                  title={locked ? 'Desbloquear' : 'Fijar valor'}>
                  <i className={`bi ${locked ? 'bi-lock-fill' : 'bi-unlock'}`} style={{ fontSize: '.85rem' }} />
                </button>
              </div>
            );
          })}
          <div style={{ fontSize: '.78rem', textAlign: 'right', marginTop: 6, color: sumOk ? '#34d399' : '#f87171' }}>
            ${fmt(Math.round(sumEdit * 100) / 100)} / ${fmt(total)} {sumOk ? '✓' : '⚠ no coincide'}
          </div>
        </div>
      );
    }

    if (editingTab === 'porcentaje') {
      const sumPct = allKeys.reduce((s, k) => s + (editPercents[k] || 0), 0);
      const sumOk = Math.abs(sumPct - 100) < 0.6;
      return (
        <div>
          <p style={{ fontSize: '.78rem', color: 'var(--text-muted)', fontStyle: 'italic', marginBottom: 10 }}>
            Ingrese el porcentaje que paga cada persona
          </p>
          {allKeys.map(k => {
            const locked = lockedKeys.has(k);
            const pct = editPercents[k] ?? Math.round(100 / allKeys.length * 10) / 10;
            const amt = Math.round(total * pct / 100 * 100) / 100;
            return (
              <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ minWidth: 90, color: 'var(--text-muted)', fontSize: '.85rem', flexShrink: 0 }}>
                  {k === 'tu' && <i className="bi bi-person-fill" style={{ opacity: .35, marginRight: 4 }} />}
                  {labels[k]}
                </span>
                <div style={{ display: 'flex', flex: 1 }}>
                  <input type="number" value={pct} min="0" max="100" step="0.1"
                    style={{ borderRadius: '8px 0 0 8px', borderRight: 'none' }}
                    onChange={e => handleEditPercent(k, e.target.value, expense)} />
                  <span style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderLeft: 'none', borderRadius: '0 8px 8px 0', padding: '6px 10px', fontSize: '.8rem', color: 'var(--text-muted)' }}>%</span>
                </div>
                <span style={{ minWidth: 60, textAlign: 'right', fontSize: '.82rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                  ${fmt(amt)}
                </span>
                <button onClick={() => toggleLock(k)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, flexShrink: 0, color: locked ? '#e8b83c' : 'rgba(255,255,255,.18)' }}
                  title={locked ? 'Desbloquear' : 'Fijar valor'}>
                  <i className={`bi ${locked ? 'bi-lock-fill' : 'bi-unlock'}`} style={{ fontSize: '.85rem' }} />
                </button>
              </div>
            );
          })}
          <div style={{ fontSize: '.78rem', textAlign: 'right', marginTop: 6, color: sumOk ? '#34d399' : '#f87171' }}>
            {fmt(Math.round(sumPct * 10) / 10)}% / 100% {sumOk ? '✓' : '⚠ no coincide'}
          </div>
        </div>
      );
    }

    if (editingTab === 'propina') {
      const base = Math.round(total / (1 + editTipPct / 100) * 100) / 100;
      const tipAmt = Math.round((total - base) * 100) / 100;
      const sumBase = allKeys.reduce((s, k) => s + (editBaseAmts[k] || 0), 0);
      const baseOk = Math.abs(sumBase - base) < 0.6;
      return (
        <div>
          <p style={{ fontSize: '.78rem', color: 'var(--text-muted)', fontStyle: 'italic', marginBottom: 10 }}>
            Ingrese los montos originales antes de agregar propina
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '.82rem', flexShrink: 0 }}>Propina</span>
            <div style={{ display: 'flex', maxWidth: 90 }}>
              <input type="number" value={editTipPct} min="0" max="99" step="1"
                style={{ borderRadius: '8px 0 0 8px', borderRight: 'none' }}
                onChange={e => handleTipPct(e.target.value, expense)} />
              <span style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderLeft: 'none', borderRadius: '0 8px 8px 0', padding: '6px 10px', fontSize: '.8rem', color: 'var(--text-muted)' }}>%</span>
            </div>
            <span style={{ fontSize: '.78rem', color: 'var(--text-muted)' }}>
              Sin propina ${fmt(base)} · Propina ${fmt(tipAmt)}
            </span>
          </div>
          {allKeys.map(k => {
            const locked = lockedKeys.has(k);
            const baseAmt = editBaseAmts[k] ?? Math.round(base / allKeys.length * 100) / 100;
            const finalAmt = Math.round(baseAmt * (1 + editTipPct / 100) * 100) / 100;
            return (
              <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ minWidth: 90, color: 'var(--text-muted)', fontSize: '.85rem', flexShrink: 0 }}>
                  {k === 'tu' && <i className="bi bi-person-fill" style={{ opacity: .35, marginRight: 4 }} />}
                  {labels[k]}
                </span>
                <div style={{ display: 'flex', flex: 1 }}>
                  <span style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRight: 'none', borderRadius: '8px 0 0 8px', padding: '6px 10px', fontSize: '.8rem', color: 'var(--text-muted)' }}>$</span>
                  <input type="number" value={baseAmt} min="0" step="1"
                    style={{ borderRadius: '0 8px 8px 0', borderLeft: 'none' }}
                    onChange={e => handleEditBaseAmt(k, e.target.value, expense)} />
                </div>
                <span style={{ minWidth: 60, textAlign: 'right', fontSize: '.82rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                  = ${fmt(finalAmt)}
                </span>
                <button onClick={() => toggleLock(k)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, flexShrink: 0, color: locked ? '#e8b83c' : 'rgba(255,255,255,.18)' }}
                  title={locked ? 'Desbloquear' : 'Fijar valor'}>
                  <i className={`bi ${locked ? 'bi-lock-fill' : 'bi-unlock'}`} style={{ fontSize: '.85rem' }} />
                </button>
              </div>
            );
          })}
          <div style={{ fontSize: '.78rem', textAlign: 'right', marginTop: 6, color: baseOk ? '#34d399' : '#f87171' }}>
            Base: ${fmt(Math.round(sumBase * 100) / 100)} / ${fmt(base)} {baseOk ? '✓' : '⚠ no coincide'}
          </div>
        </div>
      );
    }

    if (editingTab === 'descuento') {
      const sumPre = allKeys.reduce((s, k) => s + (editPreAmts[k] || 0), 0);
      const discAmt = Math.max(0, Math.round((sumPre - total) * 100) / 100);
      const discPct = sumPre > 0 ? Math.round(discAmt / sumPre * 1000) / 10 : 0;
      const factor = sumPre > 0 ? total / sumPre : 1;
      const hasDisc = sumPre > total + 0.5;
      return (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 12, fontSize: '.82rem' }}>
            <span style={{ color: 'var(--text-muted)' }}>Sin descuento: <strong style={{ color: 'var(--text)' }}>${fmt(sumPre)}</strong></span>
            <span style={{ color: 'var(--text-muted)' }}>Total final: <strong style={{ color: 'var(--text)' }}>${fmt(total)}</strong></span>
            {hasDisc
              ? <span style={{ color: '#e8b83c' }}>Descuento: <strong>${fmt(discAmt)} ({discPct}%)</strong></span>
              : <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Ingrese los montos originales antes de descuento por persona</span>
            }
          </div>
          {allKeys.map(k => {
            const pre = editPreAmts[k] ?? 0;
            const finalAmt = Math.round(pre * factor * 100) / 100;
            return (
              <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ minWidth: 90, color: 'var(--text-muted)', fontSize: '.85rem', flexShrink: 0 }}>
                  {k === 'tu' && <i className="bi bi-person-fill" style={{ opacity: .35, marginRight: 4 }} />}
                  {labels[k]}
                </span>
                <div style={{ display: 'flex', flex: 1 }}>
                  <span style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRight: 'none', borderRadius: '8px 0 0 8px', padding: '6px 10px', fontSize: '.8rem', color: 'var(--text-muted)' }}>$</span>
                  <input type="number" value={pre} min="0" step="1"
                    style={{ borderRadius: '0 8px 8px 0', borderLeft: 'none' }}
                    onChange={e => handleEditPreAmt(k, e.target.value)} />
                </div>
                <span style={{ minWidth: 70, textAlign: 'right', fontSize: '.82rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                  → ${fmt(finalAmt)}
                </span>
              </div>
            );
          })}
        </div>
      );
    }
    return null;
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  if (!user) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: 'var(--text-muted)', fontSize: '.9rem' }}>Cargando...</div>
      </div>
    );
  }

  const unreadCount = notifications.filter(n => !n.read).length;

  const btnStyle = {
    contacts: {
      border: '1px solid rgba(201,154,20,.4)', color: 'var(--gold2)',
      background: 'rgba(201,154,20,.1)', borderRadius: 8, padding: '6px 14px',
      fontSize: '.85rem', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
    },
  };

  return (
    <div style={{ minHeight: '100vh' }}>
      {/* ── Navbar ── */}
      <div style={{ background: '#080600', borderBottom: '1px solid rgba(201,154,20,.15)', paddingTop: 'calc(14px + env(safe-area-inset-top, 0px))', paddingBottom: '14px', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: 680, margin: '0 auto', padding: '0 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          {/* Logo button */}
          <button onClick={() => setShowAbout(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px', fontSize: '1.3rem', lineHeight: 1, display: 'flex', alignItems: 'center' }}>
            <i className="bi bi-cash-stack" style={{ background: 'var(--grad)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }} />
          </button>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button style={btnStyle.contacts} onClick={() => setShowResumen(true)}>
              <i className="bi bi-bar-chart-line" style={{ marginRight: 4 }} />Resumen
            </button>
            <button style={btnStyle.contacts} onClick={() => { setShowFriends(true); fetchFriends(); }}>
              <i className="bi bi-people" style={{ marginRight: 4 }} />Amigos
            </button>

            {/* ── Notification bell ── */}
            <div ref={notifMenuRef} style={{ position: 'relative' }}>
              <button onClick={() => { setShowNotifications(v => !v); setShowUserMenu(false); }}
                style={{ background: 'none', border: '1px solid rgba(201,154,20,.3)', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', color: unreadCount > 0 ? 'var(--gold2)' : 'var(--text-muted)', position: 'relative', fontFamily: 'inherit' }}>
                <i className="bi bi-bell" />
                {unreadCount > 0 && (
                  <span style={{ position: 'absolute', top: -5, right: -5, background: '#ef4444', color: '#fff', borderRadius: '50%', minWidth: 17, height: 17, fontSize: '.62rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, padding: '0 3px' }}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
              {showNotifications && (
                <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 8px)', width: 300, background: '#1a1600', border: '1px solid rgba(201,154,20,.2)', borderRadius: 12, zIndex: 200, overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,.7)' }}>
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(201,154,20,.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600, fontSize: '.9rem' }}>Notificaciones</span>
                    {unreadCount > 0 && (
                      <button onClick={() => markNotificationsRead(null)} style={{ background: 'none', border: 'none', color: 'var(--gold)', fontSize: '.75rem', cursor: 'pointer', fontFamily: 'inherit' }}>
                        Marcar todo leído
                      </button>
                    )}
                  </div>
                  <div style={{ maxHeight: 360, overflowY: 'auto' }}>
                    {notifications.length === 0 ? (
                      <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: '.85rem' }}>Sin notificaciones</div>
                    ) : notifications.map(n => {
                      const isPaidAction = n.type === 'charge_paid' && !n.read;
                      return (
                        <div key={n.id}
                          onClick={() => !n.read && !isPaidAction && markNotificationsRead([n.id])}
                          style={{ padding: '12px 16px', borderBottom: '1px solid rgba(201,154,20,.06)', background: n.read ? 'transparent' : 'rgba(201,154,20,.05)', cursor: (!n.read && !isPaidAction) ? 'pointer' : 'default', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                          <i className={`bi ${n.type === 'friend_request' ? 'bi-person-plus-fill' : 'bi-cash-coin'}`} style={{ color: 'var(--gold)', marginTop: 2, flexShrink: 0 }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '.85rem', color: n.read ? 'var(--text-muted)' : 'var(--text)', lineHeight: 1.4 }}>{n.message}</div>
                            <div style={{ fontSize: '.72rem', color: 'var(--text-muted)', marginTop: 3 }}>{relativeTime(n.createdAt)}</div>
                            {isPaidAction && (
                              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                                <button onClick={e => { e.stopPropagation(); handleNotifAction(n.id, 'accept'); }}
                                  style={{ flex: 1, background: 'rgba(52,211,153,.15)', border: '1px solid rgba(52,211,153,.35)', color: 'var(--paid)', padding: '5px 0', borderRadius: 7, cursor: 'pointer', fontSize: '.78rem', fontWeight: 600, fontFamily: 'inherit' }}>
                                  <i className="bi bi-check-lg" style={{ marginRight: 4 }} />Aceptar
                                </button>
                                <button onClick={e => { e.stopPropagation(); handleNotifAction(n.id, 'reject'); }}
                                  style={{ flex: 1, background: 'rgba(248,113,113,.12)', border: '1px solid rgba(248,113,113,.3)', color: 'var(--red)', padding: '5px 0', borderRadius: 7, cursor: 'pointer', fontSize: '.78rem', fontWeight: 600, fontFamily: 'inherit' }}>
                                  <i className="bi bi-x-lg" style={{ marginRight: 4 }} />Rechazar
                                </button>
                              </div>
                            )}
                          </div>
                          {!n.read && !isPaidAction && <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--gold)', flexShrink: 0, marginTop: 5 }} />}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* ── User avatar + dropdown menu ── */}
            <div ref={userMenuRef} style={{ position: 'relative' }}>
              <button onClick={() => { setShowUserMenu(v => !v); setShowNotifications(false); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex', alignItems: 'center', borderRadius: '50%' }}>
                <UserAvatar user={user} size={34} />
              </button>
              {showUserMenu && (
                <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 8px)', width: 220, background: '#1a1600', border: '1px solid rgba(201,154,20,.2)', borderRadius: 12, zIndex: 200, overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,.7)' }}>
                  <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(201,154,20,.1)', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <UserAvatar user={user} size={36} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: '.88rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.displayName}</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '.75rem' }}>@{user.username}</div>
                    </div>
                  </div>
                  {[
                    { icon: 'bi-image', label: 'Cambiar foto', action: () => { setProfileTab('avatar'); setShowProfile(true); setShowUserMenu(false); } },
                    { icon: 'bi-pencil', label: 'Cambiar nombre', action: () => { setProfileTab('name'); setProfileDisplayName(user.displayName); setProfileError(''); setShowProfile(true); setShowUserMenu(false); } },
                    { icon: 'bi-lock', label: 'Cambiar contraseña', action: () => { setProfileTab('password'); setProfileCurrentPwd(''); setProfileNewPwd(''); setProfileError(''); setShowProfile(true); setShowUserMenu(false); } },
                  ].map(item => (
                    <button key={item.label} onClick={item.action}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '11px 16px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)', fontSize: '.87rem', fontFamily: 'inherit', textAlign: 'left' }}>
                      <i className={`bi ${item.icon}`} style={{ color: 'var(--gold)', width: 16, textAlign: 'center' }} />
                      {item.label}
                    </button>
                  ))}
                  <div style={{ borderTop: '1px solid rgba(201,154,20,.1)' }}>
                    <button onClick={handleLogout}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '11px 16px', background: 'none', border: 'none', cursor: 'pointer', color: '#f87171', fontSize: '.87rem', fontFamily: 'inherit' }}>
                      <i className="bi bi-box-arrow-right" style={{ width: 16, textAlign: 'center' }} />
                      Cerrar sesión
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Main tabs ── */}
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '0 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--border)', marginBottom: 20, marginTop: 16 }}>
          {[
            { key: 'gastos', label: 'Mis gastos' },
            { key: 'cobran', label: 'Me cobran' },
          ].map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                padding: '10px 20px', fontSize: '.92rem', fontWeight: 600, position: 'relative',
                color: activeTab === t.key ? 'var(--gold2)' : 'var(--text-muted)',
                borderBottom: activeTab === t.key ? '2px solid var(--gold2)' : '2px solid transparent',
                marginBottom: -1, display: 'flex', alignItems: 'center', gap: 6,
              }}>
              {t.label}
              {t.badge > 0 && (
                <span style={{ background: 'var(--red)', color: '#fff', borderRadius: 99, fontSize: '.7rem', padding: '1px 7px', fontWeight: 700 }}>
                  {t.badge}
                </span>
              )}
            </button>
          ))}
          {isIOS && (
            <button onClick={async () => { await Promise.all([fetchExpenses(), fetchIncoming(), fetchFriends(), fetchNotifications()]); showToast('Actualizado.', 'success'); }}
              style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '6px 4px', marginBottom: -1, fontSize: '1.05rem' }}
              title="Actualizar">
              <i className="bi bi-arrow-clockwise" />
            </button>
          )}
        </div>

        {/* ══ TAB: Mis gastos ══ */}
        {activeTab === 'gastos' && (
          <div>
            {/* Add expense form */}
            <div className="card" style={{ marginBottom: 24, padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <span style={{ fontSize: '.78rem', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--gold)', whiteSpace: 'nowrap' }}>Nuevo Gasto</span>
                <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg,rgba(201,154,20,.35),transparent)' }} />
              </div>

              <div className="expense-form">
                {/* Monto */}
                <div className="ef-monto">
                  <label style={{ fontSize: '.72rem', fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Monto</label>
                  <div style={{ display: 'flex' }}>
                    <span style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRight: 'none', borderRadius: '8px 0 0 8px', padding: '8px 10px', fontSize: '.8rem', color: 'var(--text-muted)' }}>$</span>
                    <input type="number" placeholder="0" value={formTotal} min="1" step="1"
                      style={{ borderRadius: '0 8px 8px 0', borderLeft: 'none' }}
                      onChange={e => setFormTotal(e.target.value)} />
                  </div>
                </div>

                {/* Nombre */}
                <div className="ef-nombre">
                  <label style={{ fontSize: '.72rem', fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Nombre</label>
                  <input type="text" placeholder="Cena, arriendo..." value={formName}
                    onChange={e => setFormName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && createExpense()} />
                </div>

                {/* Personas */}
                <div className="ef-people" style={{ position: 'relative' }} ref={peopleWrapRef}>
                  <label style={{ fontSize: '.72rem', fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Personas</label>
                  <div onClick={() => setPanelOpen(p => !p)}
                    style={{
                      background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8,
                      padding: '8px 12px', cursor: 'pointer', minHeight: 40,
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      color: selectedPeople.length ? 'var(--text)' : 'var(--text-muted)',
                      userSelect: 'none',
                    }}>
                    <span style={{ fontSize: 14 }}>
                      {selectedPeople.length === 0 ? 'Seleccionar...' :
                        selectedPeople.length === 1 ? '1 persona' : `${selectedPeople.length} personas`}
                    </span>
                    <i className="bi bi-chevron-down" style={{ fontSize: '.75rem', opacity: .4 }} />
                  </div>

                  {/* People dropdown panel */}
                  {panelOpen && (
                    <div style={{
                      position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 1050,
                      background: 'var(--surface2)', border: '1px solid rgba(201,154,20,.2)', borderRadius: 12,
                      overflow: 'hidden', maxHeight: 260, overflowY: 'auto',
                      boxShadow: '0 8px 28px rgba(0,0,0,.6)',
                    }}>
                      {/* Accepted friends */}
                      {acceptedFriends.length > 0 && (
                        <div style={{ padding: '6px 14px 2px', fontSize: '.68rem', fontWeight: 700, color: 'var(--gold)', letterSpacing: '.08em', textTransform: 'uppercase' }}>
                          Amigos
                        </div>
                      )}
                      {acceptedFriends.map(f => {
                        const sel = selectedPeople.some(p => p.userId === f.userId);
                        return (
                          <div key={f.friendshipId}
                            onClick={() => togglePersonInPanel(f.displayName, f.userId)}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                              cursor: 'pointer', color: sel ? 'var(--gold2)' : 'var(--text-muted)',
                              background: sel ? 'rgba(201,154,20,.12)' : 'transparent', fontSize: '.9rem',
                            }}>
                            <i className={`bi ${sel ? 'bi-check-circle-fill' : 'bi-circle'}`} style={{ fontSize: '.9rem' }} />
                            {f.displayName}
                            <span style={{ fontSize: '.75rem', opacity: .5, marginLeft: 'auto' }}>@{f.username}</span>
                          </div>
                        );
                      })}

                      {/* Contacts */}
                      {contacts.length > 0 && (
                        <div style={{ padding: '6px 14px 2px', fontSize: '.68rem', fontWeight: 700, color: 'var(--gold)', letterSpacing: '.08em', textTransform: 'uppercase', borderTop: acceptedFriends.length ? '1px solid rgba(201,154,20,.1)' : 'none' }}>
                          Contactos
                        </div>
                      )}
                      {contacts.map(c => {
                        const sel = selectedPeople.some(p => p.name.toLowerCase() === c.toLowerCase() && !p.userId);
                        return (
                          <div key={c}
                            onClick={() => togglePersonInPanel(c, null)}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                              cursor: 'pointer', color: sel ? 'var(--gold2)' : 'var(--text-muted)',
                              background: sel ? 'rgba(201,154,20,.12)' : 'transparent', fontSize: '.9rem',
                            }}>
                            <i className={`bi ${sel ? 'bi-check-circle-fill' : 'bi-circle'}`} style={{ fontSize: '.9rem' }} />
                            {c}
                          </div>
                        );
                      })}

                      {acceptedFriends.length === 0 && contacts.length === 0 && (
                        <div style={{ padding: '10px 14px', color: 'var(--text-muted)', fontSize: '.82rem', cursor: 'default' }}>
                          Sin amigos ni contactos — usa "Otro..." para agregar
                        </div>
                      )}

                      {/* Otro */}
                      <div onClick={handleOtroClick}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                          cursor: 'pointer', color: 'var(--gold2)', borderTop: '1px solid rgba(201,154,20,.1)',
                          fontSize: '.9rem',
                        }}>
                        <i className="bi bi-plus-circle" style={{ fontSize: '.9rem' }} />
                        Otro...
                      </div>
                    </div>
                  )}
                </div>

                {/* Fecha */}
                <div className="ef-fecha">
                  <label style={{ fontSize: '.72rem', fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Fecha</label>
                  <input type="date" value={formDate} onChange={e => setFormDate(e.target.value)} />
                </div>

                {/* Botón agregar */}
                <button className="btn-primary ef-boton" onClick={createExpense} style={{ padding: '9px 36px' }}>
                  <i className="bi bi-plus-lg" />
                </button>
              </div>

              {/* Chips */}
              {selectedPeople.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                  {selectedPeople.map((p, i) => (
                    <span key={i} style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      background: 'rgba(201,154,20,.18)', border: '1px solid rgba(201,154,20,.35)',
                      color: 'var(--gold2)', borderRadius: 99, padding: '4px 10px 4px 12px', fontSize: '.82rem', fontWeight: 500,
                    }}>
                      {p.name}
                      {p.userId && <span style={{ fontSize: '.7rem', opacity: .6 }}>✓</span>}
                      <button onClick={() => removeChip(i)}
                        style={{ background: 'none', border: 'none', color: 'inherit', padding: 0, lineHeight: 1, cursor: 'pointer', opacity: .6, fontSize: '1rem' }}>
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {/* Preview */}
              {previewShare !== null && (
                <div style={{ marginTop: 8, fontSize: '.82rem', color: 'var(--text-muted)' }}>
                  {previewPeople} persona{previewPeople > 1 ? 's' : ''} + tú = ${fmt(previewShare)} cada uno
                </div>
              )}
            </div>

            {/* Month selector + filter */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', flex: 1, minWidth: 0 }}>
                  {[...months].reverse().map(m => (
                    <button key={m} onClick={() => setSelectedMonth(m)}
                      style={{
                        padding: '5px 14px', borderRadius: 99, border: '1px solid rgba(201,154,20,.22)',
                        background: m === selectedMonth ? 'var(--grad)' : 'rgba(201,154,20,.07)',
                        color: m === selectedMonth ? '#0e0b00' : 'var(--text-muted)',
                        fontSize: '.78rem', fontWeight: m === selectedMonth ? 700 : 500,
                        cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit',
                        boxShadow: m === selectedMonth ? '0 2px 12px rgba(201,154,20,.35)' : 'none',
                      }}>
                      {fmtMonth(m)}
                    </button>
                  ))}
                  <button onClick={() => { setAddMonthVal(''); setShowAddMonth(true); }}
                    style={{
                      padding: '5px 10px', borderRadius: 99, border: '1px solid rgba(201,154,20,.22)',
                      background: 'rgba(201,154,20,.07)', color: 'var(--text-muted)',
                      fontSize: '.85rem', cursor: 'pointer', fontFamily: 'inherit', lineHeight: 1.4,
                    }}>
                    <i className="bi bi-plus-lg" />
                  </button>
                </div>
                <button onClick={() => setFilterPending(p => !p)}
                  style={{
                    background: filterPending ? 'rgba(255,255,255,.04)' : 'rgba(201,154,20,.18)',
                    border: filterPending ? '1px solid rgba(255,255,255,.12)' : '1px solid rgba(201,154,20,.5)',
                    color: filterPending ? 'var(--text-muted)' : 'var(--gold2)',
                    cursor: 'pointer', padding: '5px 12px', borderRadius: 8,
                    fontSize: '.8rem', fontWeight: 500, whiteSpace: 'nowrap', fontFamily: 'inherit',
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                  }}>
                  <i className={`bi ${filterPending ? 'bi-eye' : 'bi-eye-slash'}`} />
                  {filterPending ? 'Ver todo' : 'Solo pendientes'}
                </button>
              </div>
            </div>

            {/* Expense list */}
            {filteredExpenses.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
                <i className="bi bi-receipt" style={{ fontSize: '3rem', opacity: .3, display: 'block' }} />
                <p style={{ marginTop: 12, fontSize: '.9rem' }}>
                  {filterPending
                    ? `Sin gastos pendientes en ${fmtMonth(selectedMonth)}`
                    : `Sin gastos en ${fmtMonth(selectedMonth)}`}
                </p>
              </div>
            ) : (
              filteredExpenses.map(e => {
                const totalPaid = e.charges.filter(c => c.paid).reduce((s, c) => s + c.amount, 0);
                const pendiente = e.charges.reduce((s, c) => s + c.amount, 0) - totalPaid;
                const myShare = e.myShare ?? Math.round(e.total / (e.charges.length + 1) * 100) / 100;
                const allPaid = e.charges.length === 0 || e.charges.every(c => c.paid);
                const isEditing = editingId === e.id;
                const isCompleting = completingExpenses.current.has(e.id);

                return (
                  <div key={e.id}
                    data-expense-id={e.id}
                    style={{
                      background: allPaid ? 'rgba(52,211,153,.05)' : 'var(--surface)',
                      border: `1px solid ${allPaid ? 'rgba(52,211,153,.2)' : 'var(--border)'}`,
                      borderRadius: 16,
                      marginBottom: 16,
                      position: 'relative',
                      overflow: 'hidden',
                    }}>
                    {/* Left accent stripe */}
                    <div style={{
                      position: 'absolute', left: 0, top: 0, bottom: 0, width: 4,
                      background: allPaid ? 'var(--paid)' : 'var(--grad)',
                      borderRadius: '16px 0 0 16px',
                    }} />

                    <div style={{ padding: '16px 16px 12px 20px' }}>
                      {/* Top row: amount + title */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                        <div style={{ fontSize: '2rem', fontWeight: 700, color: '#fff', lineHeight: 1, flexShrink: 0 }}>
                          ${fmt(e.total)}
                        </div>
                        <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                          <div style={{ fontSize: '1rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.name}</div>
                          <div style={{ fontSize: '.75rem', color: 'var(--text-muted)' }}>{fmtDate(e.date)}</div>
                        </div>
                      </div>
                      {/* Badges row */}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 11px', borderRadius: 7, fontSize: '.78rem', fontWeight: 500, whiteSpace: 'nowrap', background: 'rgba(201,154,20,.15)', color: 'var(--gold2)' }}>
                          <i className="bi bi-person-fill" /> Tu parte ${fmt(myShare)}
                        </span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 11px', borderRadius: 7, fontSize: '.78rem', fontWeight: 500, whiteSpace: 'nowrap', background: 'rgba(248,113,113,.12)', color: '#fca5a5' }}>
                          <i className="bi bi-clock" /> Pendiente ${fmt(pendiente)}
                        </span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 11px', borderRadius: 7, fontSize: '.78rem', fontWeight: 500, whiteSpace: 'nowrap', background: 'rgba(52,211,153,.12)', color: 'var(--paid)' }}>
                          <i className="bi bi-check-circle" /> Cobrado ${fmt(totalPaid)}
                        </span>
                      </div>

                      {/* Charges row or edit panel */}
                      {isEditing ? (
                        <div style={{ marginTop: 16, background: 'rgba(201,154,20,.05)', border: '1px solid rgba(201,154,20,.12)', borderRadius: 12, padding: 14 }}>
                          {/* Edit fields */}
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                            <div style={{ flex: '1 1 100%' }}>
                              <label style={{ fontSize: '.7rem', fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Nombre</label>
                              <input type="text" value={editName} onChange={e => setEditName(e.target.value)} />
                            </div>
                            <div style={{ flex: '1 1 130px' }}>
                              <label style={{ fontSize: '.7rem', fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Fecha</label>
                              <input type="date" value={editDate} onChange={ev => setEditDate(ev.target.value)} />
                            </div>
                            <div style={{ flex: '0 0 110px' }}>
                              <label style={{ fontSize: '.7rem', fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Total</label>
                              <div style={{ display: 'flex' }}>
                                <span style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRight: 'none', borderRadius: '8px 0 0 8px', padding: '8px 8px', fontSize: '.8rem', color: 'var(--text-muted)' }}>$</span>
                                <input type="number" value={editTotal} min="1" step="1"
                                  style={{ borderRadius: '0 8px 8px 0', borderLeft: 'none' }}
                                  onChange={ev => handleEditTotalChange(ev.target.value, e)} />
                              </div>
                            </div>
                          </div>

                          {/* Distribution tabs */}
                          <div style={{ borderTop: '1px solid rgba(255,255,255,.07)', paddingTop: 12, marginBottom: 8 }}>
                            <div style={{ fontSize: '.7rem', fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8 }}>Distribución</div>
                            <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(255,255,255,.1)', marginBottom: 12 }}>
                              {['monto', 'porcentaje', 'propina', 'descuento'].map(tab => (
                                <button key={tab} onClick={() => switchEditTab(tab, e)}
                                  style={{
                                    flex: 1, padding: '6px 4px', fontSize: '.73rem', fontWeight: 600,
                                    background: editingTab === tab ? 'rgba(201,154,20,.2)' : 'transparent',
                                    border: 'none', borderRight: tab !== 'descuento' ? '1px solid rgba(255,255,255,.08)' : 'none',
                                    color: editingTab === tab ? 'var(--gold2)' : 'var(--text-muted)',
                                    cursor: 'pointer', fontFamily: 'inherit',
                                  }}>
                                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                                </button>
                              ))}
                            </div>
                            {renderEditTabContent(e)}
                          </div>

                          {/* Save / Cancel */}
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                            <button onClick={() => saveEdit(e)}
                              style={{ background: 'linear-gradient(135deg,#34d399,#10b981)', border: 'none', color: '#022c22', fontWeight: 600, padding: '6px 14px', borderRadius: 8, cursor: 'pointer', fontSize: '.78rem', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 4 }}>
                              <i className="bi bi-check-lg" /> Guardar
                            </button>
                            <button onClick={cancelEdit} className="btn-secondary" style={{ padding: '6px 12px', fontSize: '.78rem' }}>
                              <i className="bi bi-x-lg" />
                            </button>
                          </div>
                        </div>
                      ) : e.charges.length > 0 ? (
                        <div style={{ marginTop: 12, borderTop: '1px solid rgba(255,255,255,.07)', paddingTop: 12 }}>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                            {e.charges.map(c => (
                              <button key={c.id} onClick={() => toggleCharge(e.id, c.id, c.paid)}
                                style={{
                                  borderRadius: 99, padding: '6px 14px', fontSize: '.85rem', cursor: 'pointer',
                                  border: c.paid ? '1px solid rgba(52,211,153,.3)' : '1px solid rgba(255,255,255,.1)',
                                  background: c.paid ? 'rgba(52,211,153,.13)' : 'rgba(255,255,255,.05)',
                                  color: c.paid ? 'var(--paid)' : 'rgba(255,255,255,.5)',
                                  whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 6,
                                  fontFamily: 'inherit',
                                }}>
                                <i className={`bi ${c.paid ? 'bi-check-circle-fill' : 'bi-circle'}`} style={{ fontSize: '.8rem' }} />
                                {c.person}
                                <span style={{ opacity: .65 }}>${fmt(c.amount)}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>

                    {/* Footer */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '8px 16px', borderTop: '1px solid rgba(201,154,20,.08)' }}>
                      {!isEditing && (
                        <button onClick={() => startEdit(e)}
                          style={{ background: 'rgba(234,88,12,.18)', border: '1px solid rgba(234,88,12,.35)', color: '#fb923c', cursor: 'pointer', padding: '5px 9px', borderRadius: 8, fontSize: '.85rem', fontFamily: 'inherit' }}
                          title="Editar">
                          <i className="bi bi-pencil" />
                        </button>
                      )}
                      <button onClick={() => openDeleteConfirm(e.id, e.name)}
                        style={{ background: 'rgba(248,113,113,.12)', border: '1px solid rgba(248,113,113,.3)', color: '#f87171', cursor: 'pointer', padding: '5px 9px', borderRadius: 8, fontSize: '.85rem', fontFamily: 'inherit' }}
                        title="Eliminar">
                        <i className="bi bi-trash" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ══ TAB: Me cobran ══ */}
        {activeTab === 'cobran' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
              <button onClick={() => setFilterIncomingPending(p => !p)}
                style={{
                  background: filterIncomingPending ? 'rgba(201,154,20,.18)' : 'rgba(255,255,255,.04)',
                  border: filterIncomingPending ? '1px solid rgba(201,154,20,.5)' : '1px solid rgba(255,255,255,.12)',
                  color: filterIncomingPending ? 'var(--gold2)' : 'var(--text-muted)',
                  cursor: 'pointer', padding: '5px 12px', borderRadius: 8,
                  fontSize: '.8rem', fontWeight: 500, fontFamily: 'inherit',
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                }}>
                <i className={`bi ${filterIncomingPending ? 'bi-eye-slash' : 'bi-eye'}`} />
                {filterIncomingPending ? 'Ver todo' : 'Solo pendientes'}
              </button>
            </div>

            {(() => {
              const list = filterIncomingPending ? incoming.filter(i => !i.paid) : incoming;
              if (list.length === 0) {
                return (
                  <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
                    <i className="bi bi-inbox" style={{ fontSize: '3rem', opacity: .3, display: 'block' }} />
                    <p style={{ marginTop: 12, fontSize: '.9rem' }}>
                      {filterIncomingPending ? 'Sin cobros pendientes' : 'Sin cobros recibidos'}
                    </p>
                  </div>
                );
              }

              // Group by person — split items with paidAmount into two visual rows
              const byPerson = {};
              list.forEach(item => {
                const key = item.fromName || item.fromUsername;
                if (!byPerson[key]) byPerson[key] = [];
                if ((item.paidAmount || 0) > 0.01 && !item.paid) {
                  byPerson[key].push({ ...item, _displayAmount: item.paidAmount, _isPartialPaid: true, _key: `${item.id}_paid` });
                  byPerson[key].push({ ...item, _displayAmount: parseFloat((item.amount - item.paidAmount).toFixed(2)), _key: `${item.id}` });
                } else {
                  byPerson[key].push({ ...item, _displayAmount: item.amount, _key: `${item.id}` });
                }
              });

              return Object.entries(byPerson).map(([person, items]) => (
                <div key={person} style={{ marginBottom: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                    <span style={{ fontSize: '.78rem', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--gold)', whiteSpace: 'nowrap' }}>
                      <i className="bi bi-person-fill" style={{ marginRight: 4 }} />{person}
                    </span>
                    <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg,rgba(201,154,20,.35),transparent)' }} />
                  </div>
                  {items.map(item => (
                    <div key={item._key} className="card" style={{ marginBottom: 8, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, opacity: item._isPartialPaid ? .65 : 1 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: '.92rem', textDecoration: item._isPartialPaid ? 'line-through' : 'none' }}>{item.expenseName}</div>
                        <div style={{ fontSize: '.75rem', color: item._isPartialPaid ? 'rgba(52,211,153,.8)' : 'var(--text-muted)' }}>
                          {fmtDate(item.date)}{item._isPartialPaid && <span style={{ marginLeft: 6, fontStyle: 'italic' }}>✓ pagado parcialmente</span>}
                        </div>
                      </div>
                      <div style={{ fontWeight: 700, fontSize: '1.1rem', color: item._isPartialPaid ? 'var(--paid)' : (item.paid ? 'var(--paid)' : 'var(--text)'), textDecoration: item._isPartialPaid ? 'line-through' : 'none' }}>
                        ${fmt(item._displayAmount)}
                      </div>
                      {item._isPartialPaid ? (
                        <span style={{ fontSize: '.8rem', color: 'var(--paid)', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <i className="bi bi-check-circle-fill" />
                        </span>
                      ) : item.paid ? (
                        !filterIncomingPending ? (
                          <button onClick={() => { setRevertTarget(item); setShowRevertConfirm(true); }}
                            style={{ background: 'rgba(52,211,153,.1)', border: '1px solid rgba(52,211,153,.25)', color: 'var(--paid)', cursor: 'pointer', padding: '5px 12px', borderRadius: 8, fontSize: '.82rem', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                            <i className="bi bi-check-circle-fill" style={{ marginRight: 4 }} /> Pagado
                          </button>
                        ) : (
                          <span style={{ fontSize: '.8rem', color: 'var(--paid)', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <i className="bi bi-check-circle-fill" /> Pagado
                          </span>
                        )
                      ) : pendingRequests.has(item.id) ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: '.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
                            <i className="bi bi-hourglass-split" /> Esperando...
                          </span>
                          <button onClick={() => cancelPaymentRequest(item.expenseId, item.id)}
                            style={{ background: 'rgba(248,113,113,.1)', border: '1px solid rgba(248,113,113,.25)', color: 'var(--red)', padding: '4px 8px', borderRadius: 7, cursor: 'pointer', fontSize: '.75rem', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => toggleIncomingPaid(item.expenseId, item.id)}
                          style={{ background: 'rgba(52,211,153,.1)', border: '1px solid rgba(52,211,153,.25)', color: 'var(--paid)', cursor: 'pointer', padding: '5px 12px', borderRadius: 8, fontSize: '.82rem', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                          <i className="bi bi-check-lg" style={{ marginRight: 4 }} /> Pagado
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ));
            })()}
          </div>
        )}
      </div>

      {/* ══ MODAL: Add month ══ */}
      {showAddMonth && (
        <div className="overlay" onClick={e => e.target === e.currentTarget && setShowAddMonth(false)}>
          <div className="modal-box" style={{ maxWidth: 320 }}>
            <div className="modal-header">
              <span style={{ fontWeight: 600 }}><i className="bi bi-calendar-plus" style={{ marginRight: 8 }} />Agregar mes</span>
              <button onClick={() => setShowAddMonth(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.2rem' }}>×</button>
            </div>
            <div className="modal-body">
              <label style={{ fontSize: '.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Mes y año</label>
              <input type="month" value={addMonthVal} onChange={e => setAddMonthVal(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddMonth()} />
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowAddMonth(false)}>Cancelar</button>
              <button className="btn-primary" onClick={handleAddMonth}>Agregar</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL: Delete confirm ══ */}
      {showDeleteConfirm && deleteTarget && (
        <div className="overlay" onClick={e => e.target === e.currentTarget && setShowDeleteConfirm(false)}>
          <div className="modal-box" style={{ maxWidth: 320, textAlign: 'center' }}>
            <div className="modal-body" style={{ padding: '28px 20px 12px' }}>
              <i className="bi bi-trash3" style={{ fontSize: '2rem', color: 'var(--red)', display: 'block', marginBottom: 12 }} />
              <p style={{ fontWeight: 600, marginBottom: 6 }}>¿Eliminar?</p>
              <p style={{ color: 'var(--text-muted)', fontSize: '.9rem', margin: 0 }}>{deleteTarget.name}</p>
            </div>
            <div className="modal-footer" style={{ justifyContent: 'center', gap: 12 }}>
              <button className="btn-secondary" onClick={() => setShowDeleteConfirm(false)}>Cancelar</button>
              <button className="btn-danger" onClick={confirmDelete}>Eliminar</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL: Resumen ══ */}
      {showResumen && (
        <div className="overlay" onClick={e => e.target === e.currentTarget && setShowResumen(false)}>
          <div className="modal-box">
            <div className="modal-header">
              <span style={{ fontWeight: 600 }}><i className="bi bi-bar-chart-line" style={{ marginRight: 8 }} />Resumen de deudas</span>
              <button onClick={() => setShowResumen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.2rem' }}>×</button>
            </div>
            <div className="modal-body">
              {resumenData.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
                  <i className="bi bi-check-circle" style={{ fontSize: '2.5rem', opacity: .3, display: 'block' }} />
                  <p style={{ marginTop: 12, fontSize: '.9rem' }}>Sin deudas pendientes</p>
                </div>
              ) : resumenData.map((entry, idx) => {
                const totalOwesYou = entry.owesYou.filter(r => !r.isPartialPaid).reduce((s, r) => s + r.amount, 0);
                const totalYouOwe = entry.youOwe.filter(r => !r.isPartialPaid).reduce((s, r) => s + r.amount, 0);
                const net = totalOwesYou - totalYouOwe;
                const isCompletingCard = completingResumen.has(entry.name);
                const allRows = [...entry.owesYou, ...entry.youOwe];
                return (
                  <div key={entry.name}
                    className={isCompletingCard ? 'completing' : ''}
                    style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 12, padding: '1rem 1.1rem', marginBottom: 12, position: 'relative' }}>
                    {/* Header */}
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
                      <span style={{ fontSize: '1rem', fontWeight: 700 }}>
                        <i className="bi bi-person-fill" style={{ opacity: .4, marginRight: 8 }} />{entry.name}
                      </span>
                    </div>

                    {/* Te debe section */}
                    {entry.owesYou.length > 0 && (
                      <div style={{ marginBottom: entry.youOwe.length > 0 ? 10 : 0 }}>
                        <div style={{ fontSize: '.68rem', fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 4 }}>
                          Te debe
                        </div>
                        {entry.owesYou.map((r, ri) => (
                          <div key={ri} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '.28rem 0', borderTop: '1px solid rgba(255,255,255,.05)', fontSize: '.83rem', opacity: r.isPartialPaid ? .6 : 1 }}>
                            <span style={{ color: r.isPartialPaid ? 'rgba(52,211,153,.8)' : 'var(--text-muted)', flex: 1, paddingRight: 8, textDecoration: r.isPartialPaid ? 'line-through' : 'none' }}>
                              {r.expenseName}<span style={{ opacity: .4, marginLeft: 6, fontSize: '.75rem' }}>{fmtDate(r.date)}</span>
                              {r.isPartialPaid && <span style={{ marginLeft: 5, fontSize: '.7rem', color: 'rgba(52,211,153,.9)', textDecoration: 'none', fontStyle: 'italic' }}>✓ parcial</span>}
                            </span>
                            <span style={{ fontWeight: 500, color: r.isPartialPaid ? 'rgba(52,211,153,.7)' : 'var(--gold2)', whiteSpace: 'nowrap', textDecoration: r.isPartialPaid ? 'line-through' : 'none' }}>${fmt(r.amount)}</span>
                          </div>
                        ))}
                        {entry.owesYou.filter(r => !r.isPartialPaid).length > 1 && (
                          <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 4, fontSize: '.8rem', color: 'var(--gold)', fontWeight: 600 }}>
                            Subtotal ${fmt(totalOwesYou)}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Les debes section */}
                    {entry.youOwe.length > 0 && (
                      <div>
                        {entry.owesYou.length > 0 && <div style={{ height: 1, background: 'rgba(255,255,255,.07)', marginBottom: 10 }} />}
                        <div style={{ fontSize: '.68rem', fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: '#fca5a5', marginBottom: 4 }}>
                          Les debes
                        </div>
                        {entry.youOwe.map((r, ri) => (
                          <div key={ri} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '.28rem 0', borderTop: '1px solid rgba(255,255,255,.05)', fontSize: '.83rem', opacity: r.isPartialPaid ? .6 : 1 }}>
                            <span style={{ color: r.isPartialPaid ? 'rgba(52,211,153,.8)' : 'var(--text-muted)', flex: 1, paddingRight: 8, textDecoration: r.isPartialPaid ? 'line-through' : 'none' }}>
                              {r.expenseName}<span style={{ opacity: .4, marginLeft: 6, fontSize: '.75rem' }}>{fmtDate(r.date)}</span>
                              {r.isPartialPaid && <span style={{ marginLeft: 5, fontSize: '.7rem', color: 'rgba(52,211,153,.9)', textDecoration: 'none', fontStyle: 'italic' }}>✓ pagado</span>}
                            </span>
                            <span style={{ fontWeight: 500, color: r.isPartialPaid ? 'rgba(52,211,153,.7)' : '#fca5a5', whiteSpace: 'nowrap', textDecoration: r.isPartialPaid ? 'line-through' : 'none' }}>${fmt(r.amount)}</span>
                          </div>
                        ))}
                        {entry.youOwe.filter(r => !r.isPartialPaid).length > 1 && (
                          <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 4, fontSize: '.8rem', color: '#fca5a5', fontWeight: 600 }}>
                            Subtotal ${fmt(totalYouOwe)}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Net total row */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingTop: 8, borderTop: '2px solid rgba(255,255,255,.1)' }}>
                      <span style={{ fontSize: '.78rem', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                        {net >= 0 ? 'Te deben' : 'Les debes'}
                      </span>
                      <span style={{ fontSize: '1.1rem', fontWeight: 800, color: net >= 0 ? 'var(--gold2)' : '#fca5a5' }}>
                        {net >= 0 ? '+' : '-'}${fmt(Math.abs(net))}
                      </span>
                    </div>

                    {/* Footer buttons */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,.07)' }}>
                      <button onClick={() => { setMarkAllTarget({ entry, idx }); setShowMarkAllConfirm(true); }}
                        title="Liquidar todo"
                        style={{ background: 'rgba(52,211,153,.05)', border: '1px solid rgba(52,211,153,.14)', color: 'rgba(52,211,153,.55)', cursor: 'pointer', padding: '5px 7px', borderRadius: 7, fontSize: '.9rem', lineHeight: 1, fontFamily: 'inherit' }}>
                        <i className="bi bi-check-all" />
                      </button>
                      {entry.youOwe.some(r => !r.isPartialPaid) && (
                        <button onClick={() => { setPartialTarget(entry); setPartialAmountStr(''); setShowPartialModal(true); }}
                          title="Pago parcial"
                          style={{ background: 'rgba(59,130,246,.05)', border: '1px solid rgba(59,130,246,.2)', color: 'rgba(96,165,250,.7)', cursor: 'pointer', padding: '5px 7px', borderRadius: 7, fontSize: '.9rem', lineHeight: 1, fontFamily: 'inherit' }}>
                          <i className="bi bi-cash-coin" />
                        </button>
                      )}
                      <button onClick={() => copyResumen(entry)}
                        title="Copiar"
                        style={{ background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.12)', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px 8px', borderRadius: 7, fontSize: '.82rem', lineHeight: 1, fontFamily: 'inherit' }}>
                        <i className="bi bi-clipboard" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ══ OVERLAY: Confirm mark all paid ══ */}
      {showMarkAllConfirm && markAllTarget && (() => {
        const { entry } = markAllTarget;
        const totalOwesYou = entry.owesYou.filter(r => !r.isPartialPaid).reduce((s, r) => s + r.amount, 0);
        const totalYouOwe = entry.youOwe.filter(r => !r.isPartialPaid).reduce((s, r) => s + r.amount, 0);
        const net = totalOwesYou - totalYouOwe;
        return (
          <div style={{ position: 'fixed', inset: 0, zIndex: 1060, background: 'rgba(0,0,0,.55)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ background: '#1a1500', border: '1px solid rgba(201,154,20,.15)', borderRadius: 16, padding: '1.5rem 1.5rem 1.2rem', maxWidth: 320, width: '88%', textAlign: 'center', boxShadow: '0 8px 32px rgba(0,0,0,.6)' }}>
              <i className="bi bi-check-all" style={{ fontSize: '2rem', color: '#34d399', display: 'block', marginBottom: 12 }} />
              <p style={{ margin: '0 0 .4rem', fontWeight: 600 }}>¿Liquidar todo con {entry.name}?</p>
              {net < 0 ? (
                <p style={{ margin: '0 0 1rem', fontSize: '.83rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                  {totalOwesYou > 0 && <><span style={{ color: 'var(--gold2)' }}>Te deben ${fmt(totalOwesYou)}</span> — </>}
                  <span style={{ color: '#fca5a5' }}>les debes ${fmt(totalYouOwe)}</span><br />
                  Neto: <strong style={{ color: '#fca5a5' }}>les debes ${fmt(Math.abs(net))}</strong>.<br />
                  Se enviará solicitud de confirmación.
                </p>
              ) : (
                <p style={{ margin: '0 0 1rem', fontSize: '.83rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                  {totalYouOwe > 0 && <><span style={{ color: '#fca5a5' }}>Les debes ${fmt(totalYouOwe)}</span> — </>}
                  {totalOwesYou > 0 && <><span style={{ color: 'var(--gold2)' }}>te deben ${fmt(totalOwesYou)}</span><br /></>}
                  Neto: <strong style={{ color: 'var(--gold2)' }}>te deben ${fmt(net)}</strong>.<br />
                  Todo se marcará pagado directamente.
                </p>
              )}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                <button onClick={() => { setShowMarkAllConfirm(false); setMarkAllTarget(null); }}
                  style={{ background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.12)', color: 'var(--text-muted)', padding: '7px 18px', borderRadius: 9, cursor: 'pointer', fontSize: '.85rem', fontFamily: 'inherit' }}>
                  Cancelar
                </button>
                <button onClick={() => { setShowMarkAllConfirm(false); setMarkAllTarget(null); handleMarkAllPaid(entry); }}
                  style={{ background: 'rgba(52,211,153,.15)', border: '1px solid rgba(52,211,153,.3)', color: '#34d399', padding: '7px 18px', borderRadius: 9, cursor: 'pointer', fontSize: '.85rem', fontWeight: 600, fontFamily: 'inherit' }}>
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ══ OVERLAY: Partial payment ══ */}
      {showPartialModal && partialTarget && (() => {
        const entry = partialTarget;
        const totalYouOwe = entry.youOwe.filter(r => !r.isPartialPaid).reduce((s, r) => s + r.amount, 0);
        const payNum = parseFloat(partialAmountStr.replace(',', '.')) || 0;
        const sorted = [...entry.youOwe.filter(r => !r.isPartialPaid)].sort((a, b) => (a.date < b.date ? -1 : 1));
        let rem = payNum;
        const preview = [];
        for (const item of sorted) {
          if (rem < 0.01) break;
          const pay = Math.min(rem, item.amount);
          preview.push({ ...item, pay, isPartial: pay < item.amount - 0.01 });
          rem -= pay;
        }
        const isValid = payNum > 0;
        return (
          <div style={{ position: 'fixed', inset: 0, zIndex: 1060, background: 'rgba(0,0,0,.55)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={e => e.target === e.currentTarget && setShowPartialModal(false)}>
            <div style={{ background: '#0e1520', border: '1px solid rgba(59,130,246,.2)', borderRadius: 16, padding: '1.5rem 1.5rem 1.2rem', maxWidth: 340, width: '92%', boxShadow: '0 8px 32px rgba(0,0,0,.6)' }}>
              <i className="bi bi-cash-coin" style={{ fontSize: '1.8rem', color: '#60a5fa', display: 'block', marginBottom: 10, textAlign: 'center' }} />
              <p style={{ margin: '0 0 .2rem', fontWeight: 600, textAlign: 'center' }}>Pago parcial a {entry.name}</p>
              <p style={{ margin: '0 0 1rem', fontSize: '.83rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                Total pendiente: <span style={{ color: '#fca5a5' }}>${fmt(totalYouOwe)}</span>
              </p>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: '.78rem', fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                  Monto a pagar
                </label>
                <input
                  type="number"
                  min="1"
                  placeholder={`Máx $${fmt(totalYouOwe)}`}
                  value={partialAmountStr}
                  onChange={e => setPartialAmountStr(e.target.value)}
                  autoFocus
                  style={{ width: '100%', boxSizing: 'border-box', textAlign: 'right', fontSize: '1.1rem', fontWeight: 700 }}
                />
              </div>
              {payNum > 0 && (
                <div style={{ marginBottom: 12, background: 'rgba(255,255,255,.04)', borderRadius: 8, padding: '8px 10px', fontSize: '.8rem' }}>
                  {preview.map((item, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 0', gap: 8 }}>
                      <span style={{ color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                        {item.expenseName}
                        {item.isPartial && <span style={{ color: '#93c5fd', marginLeft: 4 }}>(parcial)</span>}
                      </span>
                      <span style={{ color: item.isPartial ? '#93c5fd' : '#34d399', fontWeight: 600, whiteSpace: 'nowrap' }}>
                        ${fmt(item.pay)}{item.isPartial && <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}> / ${fmt(item.amount)}</span>}
                      </span>
                    </div>
                  ))}
                  {payNum > totalYouOwe + 0.01 && (
                    <p style={{ margin: '6px 0 0', color: '#fbbf24', fontSize: '.76rem' }}>
                      El monto supera la deuda — se cubrirán todos los cobros.
                    </p>
                  )}
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                <button onClick={() => { setShowPartialModal(false); setPartialAmountStr(''); }}
                  style={{ background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.12)', color: 'var(--text-muted)', padding: '7px 18px', borderRadius: 9, cursor: 'pointer', fontSize: '.85rem', fontFamily: 'inherit' }}>
                  Cancelar
                </button>
                <button onClick={() => handlePartialPayment(entry)}
                  disabled={!isValid}
                  style={{ background: isValid ? 'rgba(59,130,246,.15)' : 'rgba(255,255,255,.05)', border: `1px solid ${isValid ? 'rgba(59,130,246,.4)' : 'rgba(255,255,255,.1)'}`, color: isValid ? '#60a5fa' : 'var(--text-muted)', padding: '7px 18px', borderRadius: 9, cursor: isValid ? 'pointer' : 'default', fontSize: '.85rem', fontWeight: 600, fontFamily: 'inherit' }}>
                  Enviar solicitud
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ══ MODAL: Friends / Amigos ══ */}
      {showFriends && (
        <div className="overlay" onClick={e => e.target === e.currentTarget && setShowFriends(false)}>
          <div className="modal-box">
            <div className="modal-header">
              <span style={{ fontWeight: 600 }}><i className="bi bi-people" style={{ marginRight: 8 }} />Amigos y Contactos</span>
              <button onClick={() => setShowFriends(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.2rem' }}>×</button>
            </div>
            <div className="modal-body">
              {/* My username */}
              {user && (
                <div style={{ marginBottom: 16, padding: '10px 14px', background: 'rgba(201,154,20,.07)', border: '1px solid rgba(201,154,20,.15)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <span style={{ fontSize: '.85rem', color: 'var(--text-muted)' }}>
                    Tu usuario: <strong style={{ color: 'var(--gold2)' }}>@{user.username}</strong>
                  </span>
                  <button onClick={() => { navigator.clipboard.writeText(user.username); showToast('Usuario copiado.', 'success'); }}
                    style={{ background: 'none', border: '1px solid rgba(201,154,20,.3)', color: 'var(--gold2)', borderRadius: 7, padding: '3px 10px', cursor: 'pointer', fontSize: '.8rem', fontFamily: 'inherit' }}>
                    <i className="bi bi-clipboard" style={{ marginRight: 4 }} />Copiar
                  </button>
                </div>
              )}

              {/* Add friend */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: '.78rem', fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Agregar amigo</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input type="text" placeholder="Nombre de usuario..." value={friendSearch}
                    onChange={e => { setFriendSearch(e.target.value); setFriendSearchError(''); }}
                    onKeyDown={e => e.key === 'Enter' && sendFriendRequest()} />
                  <button className="btn-primary" onClick={sendFriendRequest} style={{ whiteSpace: 'nowrap' }}>
                    <i className="bi bi-plus-lg" />
                  </button>
                </div>
                {friendSearchError && <p style={{ color: 'var(--red)', fontSize: '.82rem', marginTop: 6 }}>{friendSearchError}</p>}
              </div>

              {/* Pending received */}
              {pendingFriends.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: '.72rem', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 8 }}>
                    Solicitudes recibidas ({pendingFriends.length})
                  </div>
                  {pendingFriends.map(f => (
                    <div key={f.friendshipId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid rgba(201,154,20,.09)' }}>
                      <span style={{ fontSize: '.88rem' }}>
                        <i className="bi bi-person-fill" style={{ marginRight: 6, opacity: .4 }} />
                        {f.displayName} <span style={{ color: 'var(--text-muted)', fontSize: '.8rem' }}>@{f.username}</span>
                      </span>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => handleFriendAction(f.friendshipId, 'accept')}
                          style={{ background: 'rgba(52,211,153,.12)', border: '1px solid rgba(52,211,153,.25)', color: 'var(--paid)', padding: '4px 10px', borderRadius: 7, cursor: 'pointer', fontSize: '.8rem', fontFamily: 'inherit' }}>
                          Aceptar
                        </button>
                        <button onClick={() => handleFriendAction(f.friendshipId, 'reject')}
                          style={{ background: 'rgba(248,113,113,.1)', border: '1px solid rgba(248,113,113,.2)', color: 'var(--red)', padding: '4px 10px', borderRadius: 7, cursor: 'pointer', fontSize: '.8rem', fontFamily: 'inherit' }}>
                          Rechazar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Sent requests */}
              {sentFriends.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: '.72rem', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 8 }}>
                    Solicitudes enviadas
                  </div>
                  {sentFriends.map(f => (
                    <div key={f.friendshipId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid rgba(201,154,20,.09)' }}>
                      <span style={{ fontSize: '.88rem', color: 'var(--text-muted)' }}>
                        <i className="bi bi-person-fill" style={{ marginRight: 6, opacity: .4 }} />
                        {f.displayName} <span style={{ fontSize: '.8rem' }}>@{f.username}</span>
                        <span style={{ marginLeft: 8, fontSize: '.75rem', color: 'var(--gold)', opacity: .7 }}>Pendiente</span>
                      </span>
                      <button onClick={() => removeFriend(f.friendshipId)}
                        style={{ background: 'none', border: '1px solid rgba(248,113,113,.2)', color: 'var(--red)', padding: '4px 8px', borderRadius: 7, cursor: 'pointer', fontSize: '.8rem', fontFamily: 'inherit' }}>
                        Cancelar
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Accepted friends */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: '.72rem', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 8 }}>
                  Amigos ({acceptedFriends.length})
                </div>
                {acceptedFriends.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '.85rem' }}>Sin amigos aún. Busca a alguien por su usuario.</p>
                ) : acceptedFriends.map(f => (
                  <div key={f.friendshipId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid rgba(201,154,20,.09)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <UserAvatar user={f} size={32} />
                      <span style={{ fontSize: '.88rem' }}>
                        {f.displayName} <span style={{ color: 'var(--text-muted)', fontSize: '.8rem' }}>@{f.username}</span>
                      </span>
                    </div>
                    <button onClick={() => removeFriend(f.friendshipId)}
                      style={{ background: 'rgba(248,113,113,.08)', border: '1px solid rgba(248,113,113,.2)', color: 'var(--red)', padding: '4px 8px', borderRadius: 7, cursor: 'pointer', fontSize: '.8rem', fontFamily: 'inherit' }}>
                      <i className="bi bi-trash" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Contacts section */}
              <div>
                <div style={{ fontSize: '.72rem', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 8 }}>
                  Contactos locales
                </div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                  <input type="text" placeholder="Nombre del nuevo contacto..." value={newContactName}
                    onChange={e => setNewContactName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addContact()} />
                  <button className="btn-primary" onClick={addContact} style={{ whiteSpace: 'nowrap' }}>
                    <i className="bi bi-plus-lg" />
                  </button>
                </div>
                {contacts.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '.85rem' }}>Sin contactos registrados</p>
                ) : contacts.map(c => (
                  <div key={c} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid rgba(201,154,20,.09)' }}>
                    <span style={{ fontSize: '.88rem' }}>
                      <i className="bi bi-person-circle" style={{ marginRight: 6, opacity: .5 }} />
                      {c}
                    </span>
                    <button onClick={() => removeContact(c)}
                      style={{ background: 'rgba(248,113,113,.08)', border: '1px solid rgba(248,113,113,.2)', color: 'var(--red)', padding: '4px 8px', borderRadius: 7, cursor: 'pointer', fontSize: '.8rem', fontFamily: 'inherit' }}>
                      <i className="bi bi-trash" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL: Add person (Otro...) ══ */}
      {showAddPerson && (
        <div className="overlay" onClick={e => e.target === e.currentTarget && setShowAddPerson(false)}>
          <div className="modal-box" style={{ maxWidth: 340 }}>
            <div className="modal-header">
              <span style={{ fontWeight: 600 }}><i className="bi bi-person-plus" style={{ marginRight: 8 }} />Agregar persona</span>
              <button onClick={() => setShowAddPerson(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.2rem' }}>×</button>
            </div>
            <div className="modal-body">
              <label style={{ fontSize: '.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Nombre</label>
              <input type="text" placeholder="Ej: Pedro Soto" value={addPersonVal}
                onChange={e => setAddPersonVal(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && saveNewPerson()}
                autoFocus />
              <p style={{ fontSize: '.82rem', color: 'var(--text-muted)', marginTop: 8 }}>Se guardará en contactos y se añadirá al gasto.</p>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowAddPerson(false)}>Cancelar</button>
              <button className="btn-primary" onClick={saveNewPerson}>Guardar</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL: About ══ */}
      {showAbout && (
        <div className="overlay" onClick={() => setShowAbout(false)}>
          <div className="modal-box" style={{ maxWidth: 280, textAlign: 'center' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '32px 24px 28px' }}>
              <div style={{ fontSize: '2.8rem', marginBottom: 16 }}>
                <i className="bi bi-cash-stack" style={{ background: 'var(--grad)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }} />
              </div>
              <div style={{ fontWeight: 700, fontSize: '1.3rem', background: 'var(--grad)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', marginBottom: 8 }}>
                Gastos y Cobros
              </div>
              <div style={{ fontSize: '.78rem', color: 'var(--text-muted)' }}>by sebaf</div>
            </div>
            <div style={{ borderTop: '1px solid var(--border)', padding: '12px' }}>
              <button onClick={() => setShowAbout(false)} className="btn-secondary" style={{ width: '100%' }}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL: Revert payment confirm ══ */}
      {showRevertConfirm && revertTarget && (
        <div className="overlay" onClick={e => e.target === e.currentTarget && setShowRevertConfirm(false)}>
          <div className="modal-box" style={{ maxWidth: 360 }}>
            <div className="modal-header">
              <span style={{ fontWeight: 600 }}><i className="bi bi-arrow-counterclockwise" style={{ marginRight: 8 }} />Revertir pago</span>
              <button onClick={() => setShowRevertConfirm(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.2rem' }}>×</button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '.9rem', lineHeight: 1.5 }}>
                ¿Estás seguro de volver <strong>{revertTarget.expenseName}</strong> a <span style={{ color: '#fca5a5' }}>no pagado</span>?
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowRevertConfirm(false)}>Cancelar</button>
              <button onClick={revertIncomingPaid}
                style={{ background: 'rgba(248,113,113,.15)', border: '1px solid rgba(248,113,113,.3)', color: 'var(--red)', padding: '7px 16px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: '.85rem', fontFamily: 'inherit' }}>
                Sí, revertir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL: Profile ══ */}
      {showProfile && (
        <div className="overlay" onClick={e => e.target === e.currentTarget && setShowProfile(false)}>
          <div className="modal-box" style={{ maxWidth: 380 }}>
            <div className="modal-header">
              <span style={{ fontWeight: 600 }}><i className="bi bi-person-circle" style={{ marginRight: 8 }} />Mi perfil</span>
              <button onClick={() => setShowProfile(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.2rem' }}>×</button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
                {[{ key: 'avatar', label: 'Foto' }, { key: 'name', label: 'Nombre' }, { key: 'password', label: 'Contraseña' }].map(t => (
                  <button key={t.key} onClick={() => { setProfileTab(t.key); setProfileError(''); }}
                    style={{ flex: 1, background: 'none', border: 'none', cursor: 'pointer', padding: '8px 0', fontSize: '.85rem', fontWeight: 600, fontFamily: 'inherit', color: profileTab === t.key ? 'var(--gold2)' : 'var(--text-muted)', borderBottom: profileTab === t.key ? '2px solid var(--gold2)' : '2px solid transparent', marginBottom: -1 }}>
                    {t.label}
                  </button>
                ))}
              </div>

              {profileTab === 'avatar' && (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
                    <UserAvatar user={user} size={80} />
                  </div>
                  <input ref={avatarInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarChange} />
                  <button className="btn-primary" onClick={() => avatarInputRef.current?.click()}>
                    <i className="bi bi-upload" style={{ marginRight: 6 }} />Subir foto
                  </button>
                  {user.avatarUrl && (
                    <button className="btn-secondary" style={{ marginLeft: 8 }}
                      onClick={async () => {
                        const res = await fetch('/api/auth/profile', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ avatarUrl: null }) });
                        if (res.ok) { setUser(prev => ({ ...prev, avatarUrl: null })); showToast('Foto eliminada.', 'info'); }
                      }}>
                      Eliminar foto
                    </button>
                  )}
                  <p style={{ fontSize: '.78rem', color: 'var(--text-muted)', marginTop: 14 }}>La imagen se comprime automáticamente a 200×200px.</p>
                </div>
              )}

              {profileTab === 'name' && (
                <div>
                  <label style={{ fontSize: '.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Nombre para mostrar</label>
                  <input type="text" value={profileDisplayName}
                    onChange={e => { setProfileDisplayName(e.target.value); setProfileError(''); }}
                    onKeyDown={e => e.key === 'Enter' && updateDisplayName()} />
                  {profileError && <p style={{ color: 'var(--red)', fontSize: '.82rem', marginTop: 6 }}>{profileError}</p>}
                </div>
              )}

              {profileTab === 'password' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div>
                    <label style={{ fontSize: '.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Contraseña actual</label>
                    <input type="password" value={profileCurrentPwd} onChange={e => { setProfileCurrentPwd(e.target.value); setProfileError(''); }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Nueva contraseña</label>
                    <input type="password" value={profileNewPwd} onChange={e => { setProfileNewPwd(e.target.value); setProfileError(''); }} />
                  </div>
                  {profileError && <p style={{ color: 'var(--red)', fontSize: '.82rem' }}>{profileError}</p>}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowProfile(false)}>Cerrar</button>
              {profileTab === 'name' && (
                <button className="btn-primary" onClick={updateDisplayName}>Guardar</button>
              )}
              {profileTab === 'password' && (
                <button className="btn-primary" onClick={updatePassword}>Cambiar</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Toast ── */}
      <Toast toast={toastState} />
    </div>
  );
}
