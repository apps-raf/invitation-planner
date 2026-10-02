/**
 * Supabase Client & Real-time Synchronization Module
 */

const SUPABASE_URL = 'https://eptviaiajhwmsabexcek.supabase.co';
const SUPABASE_KEY = 'sb_publishable_HLFDRlUytI21ML70TQRPdQ_F53fgwwp';

let supabaseClient = null;

export function getSupabase() {
  if (!supabaseClient && window.supabase) {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
  }
  return supabaseClient;
}

// Session Management
const SESSION_KEY = 'invitrack_current_manager';

export function getCurrentManager() {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setCurrentManager(manager) {
  if (manager) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(manager));
  } else {
    localStorage.removeItem(SESSION_KEY);
  }
}

// Manager Authentication & PIN
export async function fetchManagers() {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb
    .from('managers')
    .select('id, name, pin, role')
    .order('name');
  if (error) {
    console.error('Error fetching managers:', error);
    return [];
  }
  return data || [];
}

export async function loginWithPin(pin) {
  const sb = getSupabase();
  if (!sb) return { success: false, message: 'Supabase non initialisé' };

  if (!pin || pin.length !== 4) {
    return { success: false, message: 'Veuillez saisir un code à 4 chiffres' };
  }

  const { data, error } = await sb
    .from('managers')
    .select('id, name, pin, role')
    .eq('pin', pin);

  if (error || !data || data.length === 0) {
    return { success: false, message: 'Code PIN incorrect' };
  }

  const manager = data[0];
  const mustChangePin = (pin === '0000');
  const sessionData = {
    id: manager.id,
    name: manager.name,
    role: manager.role,
    mustChangePin
  };

  setCurrentManager(sessionData);
  return { success: true, manager: sessionData, mustChangePin };
}

export async function verifyAndLogin(managerNameOrPin, pin) {
  if (pin === undefined) {
    return loginWithPin(managerNameOrPin);
  }

  const sb = getSupabase();
  if (!sb) return { success: false, message: 'Supabase non initialisé' };

  const { data, error } = await sb
    .from('managers')
    .select('id, name, pin, role')
    .eq('name', managerNameOrPin)
    .single();

  if (error || !data) {
    return { success: false, message: 'Utilisateur introuvable' };
  }

  if (data.pin !== pin) {
    return { success: false, message: 'Code PIN incorrect' };
  }

  const mustChangePin = (pin === '0000');
  const sessionData = {
    id: data.id,
    name: data.name,
    role: data.role,
    mustChangePin
  };

  setCurrentManager(sessionData);
  return { success: true, manager: sessionData, mustChangePin };
}

export async function updateManagerPin(managerId, newPin) {
  const sb = getSupabase();
  if (!sb) return { success: false, message: 'Supabase non disponible' };

  if (!newPin || !/^\d{4}$/.test(newPin)) {
    return { success: false, message: 'Le code PIN doit comporter 4 chiffres' };
  }

  if (newPin === '0000') {
    return { success: false, message: 'Le nouveau code ne peut pas être 0000' };
  }

  const { error } = await sb
    .from('managers')
    .update({ pin: newPin })
    .eq('id', managerId);

  if (error) {
    console.error('Error updating PIN:', error);
    return { success: false, message: 'Erreur lors de la mise à jour du PIN' };
  }

  const current = getCurrentManager();
  if (current && current.id === managerId) {
    current.mustChangePin = false;
    setCurrentManager(current);
  }

  return { success: true };
}

// Guests CRUD
export async function fetchAllGuests() {
  const sb = getSupabase();
  if (!sb) return null;

  const { data, error } = await sb
    .from('guests')
    .select('*')
    .order('name');

  if (error) {
    console.error('Error fetching guests:', error);
    return null;
  }

  return (data || []).map(row => ({
    id: row.id,
    name: row.name,
    category: row.category,
    familyName: row.family_name || '',
    branch: row.branch || '',
    gender: row.gender || '',
    status: row.status || 'pending',
    comment: row.comment || '',
    invitedAt: row.invited_at || null,
    updatedAt: row.updated_at || null,
    updatedBy: row.updated_by || 'Initial'
  }));
}

export async function updateGuest(guest, managerName) {
  const sb = getSupabase();
  if (!sb) return false;

  const { error } = await sb
    .from('guests')
    .upsert({
      id: guest.id,
      name: guest.name,
      category: guest.category,
      family_name: guest.familyName || '',
      branch: guest.branch || '',
      gender: guest.gender || '',
      status: guest.status,
      comment: guest.comment || '',
      invited_at: guest.invitedAt,
      updated_at: new Date().toISOString(),
      updated_by: managerName || 'Anonyme'
    });

  if (error) {
    console.error('Error updating guest in Supabase:', error);
    return false;
  }
  return true;
}

export async function batchUpdateGuests(updates, managerName) {
  const sb = getSupabase();
  if (!sb || !updates || updates.length === 0) return 0;

  const rows = updates.map(g => ({
    id: g.id,
    name: g.name,
    category: g.category,
    family_name: g.familyName || '',
    branch: g.branch || '',
    gender: g.gender || '',
    status: g.status,
    comment: g.comment || '',
    invited_at: g.invitedAt,
    updated_at: new Date().toISOString(),
    updated_by: managerName || 'Anonyme'
  }));

  const { error } = await sb
    .from('guests')
    .upsert(rows);

  if (error) {
    console.error('Error batch updating guests in Supabase:', error);
    return 0;
  }
  return rows.length;
}

export async function deleteGuestRecord(guestId) {
  const sb = getSupabase();
  if (!sb) return false;

  const { error } = await sb
    .from('guests')
    .delete()
    .eq('id', guestId);

  if (error) {
    console.error('Error deleting guest:', error);
    return false;
  }
  return true;
}

// Audit Log CRUD & Undo
export async function logAction(entry) {
  const sb = getSupabase();
  if (!sb) return null;

  const record = {
    manager_name: entry.managerName || 'Anonyme',
    guest_id: entry.guestId || '',
    guest_name: entry.guestName || '',
    action_type: entry.actionType, // 'invited', 'pending', 'declined', 'batch_invited', 'add', 'delete'
    previous_status: entry.previousStatus || null,
    new_status: entry.newStatus || null,
    previous_comment: entry.previousComment || '',
    new_comment: entry.newComment || '',
    undone: false
  };

  const { data, error } = await sb
    .from('audit_log')
    .insert([record])
    .select()
    .single();

  if (error) {
    console.error('Error logging audit action:', error);
    return null;
  }
  return data;
}

export async function batchLogActions(entries) {
  const sb = getSupabase();
  if (!sb || !entries || entries.length === 0) return [];

  const records = entries.map(e => ({
    manager_name: e.managerName || 'Anonyme',
    guest_id: e.guestId || '',
    guest_name: e.guestName || '',
    action_type: e.actionType,
    previous_status: e.previousStatus || null,
    new_status: e.newStatus || null,
    previous_comment: e.previousComment || '',
    new_comment: e.newComment || '',
    undone: false
  }));

  const { data, error } = await sb
    .from('audit_log')
    .insert(records)
    .select();

  if (error) {
    console.error('Error batch logging actions:', error);
    return [];
  }
  return data || [];
}

export async function fetchAuditLogs(limit = 50) {
  const sb = getSupabase();
  if (!sb) return [];

  const { data, error } = await sb
    .from('audit_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching audit logs:', error);
    return [];
  }
  return data || [];
}

export async function undoLogAction(logId, managerName) {
  const sb = getSupabase();
  if (!sb) return { success: false, message: 'Supabase non initialisé' };

  // 1. Fetch the log entry
  const { data: logEntry, error: fetchErr } = await sb
    .from('audit_log')
    .select('*')
    .eq('id', logId)
    .single();

  if (fetchErr || !logEntry) {
    return { success: false, message: 'Entrée introuvable' };
  }

  if (logEntry.undone) {
    return { success: false, message: 'Cette action a déjà été annulée' };
  }

  // 2. Rollback the guest to previous state
  if (logEntry.guest_id && logEntry.previous_status) {
    const updatePayload = {
      status: logEntry.previous_status,
      comment: logEntry.previous_comment || '',
      updated_at: new Date().toISOString(),
      updated_by: `${managerName} (Annulation)`
    };
    if (logEntry.previous_status !== 'invited') {
      updatePayload.invited_at = null;
    }

    const { error: guestErr } = await sb
      .from('guests')
      .update(updatePayload)
      .eq('id', logEntry.guest_id);

    if (guestErr) {
      console.error('Error reverting guest:', guestErr);
      return { success: false, message: 'Impossible de restaurer l\'invité' };
    }
  }

  // 3. Mark the log entry as undone
  const { error: logUpdateErr } = await sb
    .from('audit_log')
    .update({
      undone: true,
      undone_at: new Date().toISOString(),
      undone_by: managerName
    })
    .eq('id', logId);

  if (logUpdateErr) {
    console.error('Error marking log as undone:', logUpdateErr);
  }

  return {
    success: true,
    guestId: logEntry.guest_id,
    previousStatus: logEntry.previous_status,
    guestName: logEntry.guest_name
  };
}

// Real-time Subscriptions
export function setupRealtimeSubscriptions({ onGuestsChange, onAuditChange }) {
  const sb = getSupabase();
  if (!sb) return null;

  const channel = sb.channel('realtime_all')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'guests' },
      payload => {
        if (typeof onGuestsChange === 'function') {
          onGuestsChange(payload);
        }
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'audit_log' },
      payload => {
        if (typeof onAuditChange === 'function') {
          onAuditChange(payload);
        }
      }
    )
    .subscribe((status) => {
      console.log('Supabase realtime status:', status);
    });

  return channel;
}
