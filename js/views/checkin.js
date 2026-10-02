/**
 * Venue Check-in (Émargement Jour-J) View
 */

import { Utils } from '../utils.js';

export function renderCheckIn(store) {
  const { guests, stats } = store.getSnapshot();

  let search = '';
  let filterAttendance = 'all'; // 'all', 'checked', 'pending'

  const container = document.createElement('div');
  container.className = 'space-y-6 animate-fade-in';

  function getGuests() {
    return guests.filter(g => {
      // Prioritize confirmed guests or show all
      const matchSearch = !search ||
        g.name.toLowerCase().includes(search.toLowerCase()) ||
        (g.table && g.table.toLowerCase().includes(search.toLowerCase()));

      const isChecked = Boolean(g.checkedIn);
      const matchAttendance = filterAttendance === 'all' ||
        (filterAttendance === 'checked' && isChecked) ||
        (filterAttendance === 'pending' && !isChecked);

      return matchSearch && matchAttendance;
    });
  }

  function renderList() {
    const listBody = container.querySelector('#checkin-list');
    const checkedCountEl = container.querySelector('#checkin-count');
    const filtered = getGuests();

    const currentStats = store.calculateStats();
    if (checkedCountEl) {
      checkedCountEl.textContent = `${currentStats.checkedInSeats} / ${currentStats.confirmedSeats || currentStats.totalSeats} personnes arrivées`;
    }

    if (filtered.length === 0) {
      listBody.innerHTML = `
        <div class="glass-panel rounded-2xl p-8 text-center text-slate-400 border border-slate-700/60">
          <p class="font-medium text-slate-300">Aucun invité correspondant</p>
        </div>
      `;
      return;
    }

    listBody.innerHTML = filtered.map(g => {
      const isChecked = Boolean(g.checkedIn);
      return `
        <div class="glass-card rounded-2xl p-4 border ${isChecked ? 'border-emerald-500/40 bg-emerald-950/20' : 'border-slate-700/60'} flex items-center justify-between gap-4 transition">
          <div class="flex items-center gap-3">
            <button data-action="toggle-checkin" data-id="${g.id}" class="w-10 h-10 rounded-xl flex items-center justify-center transition ${isChecked ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30' : 'bg-slate-800 text-slate-500 border border-slate-700 hover:border-slate-500'}">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>
            </button>
            <div>
              <h4 class="font-bold text-white text-base flex items-center gap-2">
                <span>${escapeHtml(g.name)}</span>
                <span class="text-xs font-normal text-slate-400">(${g.seats || 1} pers.)</span>
              </h4>
              <div class="flex items-center gap-2 mt-0.5 text-xs">
                ${g.table ? `
                  <span class="px-2 py-0.5 rounded font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    🪑 ${escapeHtml(g.table)}
                  </span>
                ` : '<span class="text-slate-500 italic">Table non définie</span>'}
                ${g.notes ? `<span class="text-amber-400">⚠️ ${escapeHtml(g.notes)}</span>` : ''}
              </div>
            </div>
          </div>

          <div>
            ${isChecked ? `
              <span class="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Arrivé
              </span>
            ` : `
              <span class="px-3 py-1 rounded-full text-xs font-medium bg-slate-800 text-slate-400 border border-slate-700">
                En attente
              </span>
            `}
          </div>
        </div>
      `;
    }).join('');
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  container.innerHTML = `
    <!-- Top Bar -->
    <div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold text-white">Émargement Jour-J</h1>
        <p id="checkin-count" class="text-sm font-semibold text-emerald-400 mt-0.5">Calcul en cours...</p>
      </div>

      <!-- Filter Buttons -->
      <div class="flex items-center gap-2">
        <button data-filter="all" class="filter-attendance-btn px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 text-white">
          Tous
        </button>
        <button data-filter="pending" class="filter-attendance-btn px-3 py-1.5 rounded-xl text-xs font-medium text-slate-400 hover:text-white bg-slate-800">
          Non arrivés
        </button>
        <button data-filter="checked" class="filter-attendance-btn px-3 py-1.5 rounded-xl text-xs font-medium text-slate-400 hover:text-white bg-slate-800">
          Arrivés
        </button>
      </div>
    </div>

    <!-- Search Input -->
    <div class="relative">
      <svg class="w-5 h-5 absolute left-3.5 top-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
      <input type="text" id="checkin-search" placeholder="Recherche rapide d'un invité à l'entrée..." class="w-full bg-slate-800/90 border border-slate-700 rounded-2xl pl-11 pr-4 py-3 text-base text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition shadow-inner" />
    </div>

    <!-- Checkin list -->
    <div id="checkin-list" class="space-y-3"></div>
  `;

  setTimeout(() => {
    // Search listener
    container.querySelector('#checkin-search')?.addEventListener('input', (e) => {
      search = e.target.value;
      renderList();
    });

    // Filter listeners
    container.querySelectorAll('.filter-attendance-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        container.querySelectorAll('.filter-attendance-btn').forEach(b => {
          b.className = 'filter-attendance-btn px-3 py-1.5 rounded-xl text-xs font-medium text-slate-400 hover:text-white bg-slate-800';
        });
        btn.className = 'filter-attendance-btn px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 text-white';
        filterAttendance = btn.getAttribute('data-filter');
        renderList();
      });
    });

    // Toggle Checkin
    container.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action="toggle-checkin"]');
      if (btn) {
        const id = btn.getAttribute('data-id');
        const updated = store.toggleCheckIn(id);
        if (updated) {
          Utils.showToast(updated.checkedIn ? `Bienvenue ${updated.name} ! (Table: ${updated.table || 'Générale'})` : `${updated.name} marqué comme non arrivé`, updated.checkedIn ? 'success' : 'info');
          renderList();
        }
      }
    });

    renderList();
  }, 0);

  return container;
}
