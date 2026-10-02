/**
 * Guests Management View
 */

import { Utils } from '../utils.js';

export function renderGuests(store, navigate, params = {}) {
  const { guests } = store.getSnapshot();

  let searchTerm = '';
  let selectedCategory = 'all';
  let selectedStatus = 'all';

  const container = document.createElement('div');
  container.className = 'space-y-6 animate-fade-in';

  // Extract unique categories for filter
  const categories = Array.from(new Set(guests.map(g => g.category || 'Général'))).filter(Boolean);

  function getFilteredGuests() {
    return guests.filter(g => {
      const matchSearch = !searchTerm || 
        g.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (g.phone && g.phone.includes(searchTerm)) ||
        (g.table && g.table.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (g.notes && g.notes.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchCategory = selectedCategory === 'all' || g.category === selectedCategory;
      const matchStatus = selectedStatus === 'all' || g.status === selectedStatus;

      return matchSearch && matchCategory && matchStatus;
    });
  }

  function renderList() {
    const filtered = getFilteredGuests();
    const listBody = container.querySelector('#guests-table-body');
    const mobileCards = container.querySelector('#guests-mobile-cards');
    const countBadge = container.querySelector('#filtered-count-badge');

    if (countBadge) {
      countBadge.textContent = `${filtered.length} invité(s) affiché(s)`;
    }

    if (filtered.length === 0) {
      const emptyHtml = `
        <div class="p-12 text-center text-slate-400">
          <svg class="w-12 h-12 mx-auto mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/></svg>
          <p class="text-base font-medium text-slate-300">Aucun invité trouvé</p>
          <p class="text-xs text-slate-500 mt-1">Modifiez vos filtres ou ajoutez un nouvel invité.</p>
        </div>
      `;
      if (listBody) listBody.innerHTML = `<tr><td colspan="7">${emptyHtml}</td></tr>`;
      if (mobileCards) mobileCards.innerHTML = emptyHtml;
      return;
    }

    // Desktop Table Rows
    if (listBody) {
      listBody.innerHTML = filtered.map(g => {
        const statusBadge = getStatusBadge(g.status);
        return `
          <tr class="hover:bg-slate-800/40 border-b border-slate-700/40 transition">
            <td class="py-3 px-4">
              <div class="font-medium text-white">${escapeHtml(g.name)}</div>
              <div class="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                ${g.phone ? `<span>📞 ${escapeHtml(g.phone)}</span>` : ''}
                ${g.email ? `<span>✉️ ${escapeHtml(g.email)}</span>` : ''}
              </div>
            </td>
            <td class="py-3 px-4">
              <span class="inline-block px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-700/60 text-slate-300 border border-slate-600/30">
                ${escapeHtml(g.category || 'Général')}
              </span>
            </td>
            <td class="py-3 px-4 text-center">
              <span class="inline-flex items-center justify-center font-bold text-xs bg-indigo-500/20 text-indigo-300 w-7 h-7 rounded-full border border-indigo-500/30">
                ${g.seats || 1}
              </span>
            </td>
            <td class="py-3 px-4">
              <span class="text-xs text-slate-300">${escapeHtml(g.table || '—')}</span>
            </td>
            <td class="py-3 px-4">
              <div class="flex items-center gap-1.5">
                ${statusBadge}
              </div>
            </td>
            <td class="py-3 px-4">
              <p class="text-xs text-slate-400 max-w-xs truncate" title="${escapeHtml(g.notes || '')}">
                ${escapeHtml(g.notes || '—')}
              </p>
            </td>
            <td class="py-3 px-4 text-right">
              <div class="flex items-center justify-end gap-1.5">
                <button data-action="edit" data-id="${g.id}" class="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/60 transition" title="Modifier">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
                </button>
                <button data-action="delete" data-id="${g.id}" class="p-1.5 rounded-lg text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition" title="Supprimer">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                </button>
              </div>
            </td>
          </tr>
        `;
      }).join('');
    }

    // Mobile Cards View
    if (mobileCards) {
      mobileCards.innerHTML = filtered.map(g => {
        const statusBadge = getStatusBadge(g.status);
        return `
          <div class="glass-card rounded-xl p-4 border border-slate-700/60 space-y-3">
            <div class="flex items-start justify-between gap-2">
              <div>
                <h3 class="font-bold text-white text-base">${escapeHtml(g.name)}</h3>
                <div class="flex items-center gap-2 mt-1">
                  <span class="px-2 py-0.5 rounded text-[11px] bg-slate-700/70 text-slate-300">
                    ${escapeHtml(g.category || 'Général')}
                  </span>
                  <span class="px-2 py-0.5 rounded text-[11px] bg-indigo-500/20 text-indigo-300">
                    ${g.seats || 1} pers.
                  </span>
                  ${g.table ? `<span class="px-2 py-0.5 rounded text-[11px] bg-purple-500/20 text-purple-300">🪑 ${escapeHtml(g.table)}</span>` : ''}
                </div>
              </div>
              <div>${statusBadge}</div>
            </div>

            <div class="text-xs text-slate-400 space-y-1">
              ${g.phone ? `<p class="flex items-center gap-1.5">📞 <span>${escapeHtml(g.phone)}</span></p>` : ''}
              ${g.notes ? `<p class="italic text-slate-500">📝 ${escapeHtml(g.notes)}</p>` : ''}
            </div>

            <div class="pt-2 border-t border-slate-700/50 flex items-center justify-between">
              <!-- Quick Status Selector -->
              <select data-action="quick-status" data-id="${g.id}" class="bg-slate-800 text-xs text-slate-300 rounded-lg px-2 py-1 border border-slate-700">
                <option value="draft" ${g.status === 'draft' ? 'selected' : ''}>Brouillon</option>
                <option value="sent" ${g.status === 'sent' ? 'selected' : ''}>Envoyé</option>
                <option value="delivered" ${g.status === 'delivered' ? 'selected' : ''}>Livré</option>
                <option value="confirmed" ${g.status === 'confirmed' ? 'selected' : ''}>Confirmé</option>
                <option value="declined" ${g.status === 'declined' ? 'selected' : ''}>Décliné</option>
              </select>

              <div class="flex items-center gap-2">
                <button data-action="edit" data-id="${g.id}" class="px-2.5 py-1 text-xs rounded bg-slate-700 text-slate-200 hover:bg-slate-600 transition">
                  Modifier
                </button>
                <button data-action="delete" data-id="${g.id}" class="p-1 text-rose-400 hover:text-rose-300 transition">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                </button>
              </div>
            </div>
          </div>
        `;
      }).join('');
    }
  }

  function getStatusBadge(status) {
    const badges = {
      draft: `<span class="badge-draft px-2 py-0.5 rounded-full text-xs font-medium">Brouillon</span>`,
      sent: `<span class="badge-sent px-2 py-0.5 rounded-full text-xs font-medium">Envoyé</span>`,
      delivered: `<span class="badge-delivered px-2 py-0.5 rounded-full text-xs font-medium">Livré</span>`,
      confirmed: `<span class="badge-confirmed px-2 py-0.5 rounded-full text-xs font-medium">Confirmé</span>`,
      declined: `<span class="badge-declined px-2 py-0.5 rounded-full text-xs font-medium">Décliné</span>`
    };
    return badges[status] || badges.draft;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Initial Container Layout
  container.innerHTML = `
    <!-- Top Action Bar -->
    <div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold text-white">Gestion des Invités</h1>
        <p id="filtered-count-badge" class="text-xs text-slate-400 mt-0.5">Chargement...</p>
      </div>

      <div class="flex items-center gap-2 flex-wrap sm:flex-nowrap">
        <!-- Export CSV -->
        <button id="btn-export-csv" class="px-3 py-2 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition flex items-center gap-1.5">
          <svg class="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
          Exporter Excel
        </button>

        <!-- Import CSV -->
        <button id="btn-import-csv" class="px-3 py-2 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition flex items-center gap-1.5">
          <svg class="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
          Importer CSV
        </button>
        <input type="file" id="file-csv-input" accept=".csv" class="hidden" />

        <!-- Add Guest Button -->
        <button id="btn-add-guest" class="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-lg shadow-indigo-600/30 transition flex items-center gap-1.5">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
          Ajouter
        </button>
      </div>
    </div>

    <!-- Search & Filters Toolbar -->
    <div class="glass-panel rounded-2xl p-4 border border-slate-700/60 flex flex-col md:flex-row items-stretch md:items-center gap-3">
      <!-- Search Input -->
      <div class="relative flex-1">
        <svg class="w-4 h-4 absolute left-3 top-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
        <input type="text" id="search-input" placeholder="Rechercher par nom, tél, table..." class="w-full bg-slate-800/80 border border-slate-700 rounded-xl pl-9 pr-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition" />
      </div>

      <!-- Category Filter -->
      <div class="w-full md:w-48">
        <select id="filter-category" class="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-indigo-500">
          <option value="all">Tous les groupes</option>
          ${categories.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('')}
        </select>
      </div>

      <!-- Status Filter -->
      <div class="w-full md:w-48">
        <select id="filter-status" class="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-indigo-500">
          <option value="all">Tous les statuts</option>
          <option value="draft">Brouillon (Non envoyé)</option>
          <option value="sent">Envoyé</option>
          <option value="delivered">Livré</option>
          <option value="confirmed">Confirmé</option>
          <option value="declined">Décliné</option>
        </select>
      </div>
    </div>

    <!-- Desktop Table View -->
    <div class="hidden md:block glass-panel rounded-2xl border border-slate-700/60 overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm text-slate-300">
          <thead class="bg-slate-800/60 text-xs uppercase tracking-wider text-slate-400 border-b border-slate-700/60">
            <tr>
              <th class="py-3 px-4">Invité</th>
              <th class="py-3 px-4">Groupe</th>
              <th class="py-3 px-4 text-center">Places</th>
              <th class="py-3 px-4">Table</th>
              <th class="py-3 px-4">Statut</th>
              <th class="py-3 px-4">Notes / Régime</th>
              <th class="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody id="guests-table-body"></tbody>
        </table>
      </div>
    </div>

    <!-- Mobile Cards View -->
    <div id="guests-mobile-cards" class="md:hidden space-y-3"></div>

    <!-- Guest Edit / Add Modal Container -->
    <div id="guest-modal" class="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 hidden">
      <div class="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl animate-fade-in">
        <div class="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <h3 id="modal-title" class="text-lg font-bold text-white">Ajouter un invité</h3>
          <button id="modal-close-btn" class="text-slate-400 hover:text-white font-bold text-lg">✕</button>
        </div>
        <form id="guest-form" class="p-6 space-y-4">
          <input type="hidden" id="form-guest-id" />
          
          <div>
            <label class="block text-xs font-semibold text-slate-300 mb-1">Nom complet ou Famille *</label>
            <input type="text" id="form-name" required placeholder="ex: Jean & Marie Dupont" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500" />
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-semibold text-slate-300 mb-1">Téléphone (WhatsApp)</label>
              <input type="tel" id="form-phone" placeholder="ex: +33612345678" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500" />
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-300 mb-1">Email</label>
              <input type="email" id="form-email" placeholder="jean@example.com" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500" />
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label class="block text-xs font-semibold text-slate-300 mb-1">Groupe / Catégorie</label>
              <input type="text" id="form-category" list="category-suggestions" placeholder="ex: Amis" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500" />
              <datalist id="category-suggestions">
                <option value="Famille Mariée"></option>
                <option value="Famille Marié"></option>
                <option value="Témoins"></option>
                <option value="Amis"></option>
                <option value="Collègues"></option>
                <option value="VIP"></option>
              </datalist>
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-300 mb-1">Nombre de places</label>
              <input type="number" id="form-seats" min="1" max="20" value="1" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500" />
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-300 mb-1">Table</label>
              <input type="text" id="form-table" placeholder="ex: Table 1" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500" />
            </div>
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-300 mb-1">Statut de l'invitation</label>
            <select id="form-status" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500">
              <option value="draft">Brouillon (À envoyer)</option>
              <option value="sent">Envoyé</option>
              <option value="delivered">Livré</option>
              <option value="confirmed">Confirmé (Présent)</option>
              <option value="declined">Décliné (Absent)</option>
            </select>
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-300 mb-1">Régime alimentaire & Notes</label>
            <textarea id="form-notes" rows="2" placeholder="Végétarien, allergies, enfants, etc." class="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"></textarea>
          </div>

          <div class="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
            <button type="button" id="modal-cancel-btn" class="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white transition">Annuler</button>
            <button type="submit" class="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-lg shadow-indigo-600/30 transition">Enregistrer</button>
          </div>
        </form>
      </div>
    </div>
  `;

  // Attach event listeners
  setTimeout(() => {
    const modal = container.querySelector('#guest-modal');
    const form = container.querySelector('#guest-form');

    function openModal(guest = null) {
      if (guest) {
        container.querySelector('#modal-title').textContent = "Modifier l'invité";
        container.querySelector('#form-guest-id').value = guest.id;
        container.querySelector('#form-name').value = guest.name || '';
        container.querySelector('#form-phone').value = guest.phone || '';
        container.querySelector('#form-email').value = guest.email || '';
        container.querySelector('#form-category').value = guest.category || '';
        container.querySelector('#form-seats').value = guest.seats || 1;
        container.querySelector('#form-table').value = guest.table || '';
        container.querySelector('#form-status').value = guest.status || 'draft';
        container.querySelector('#form-notes').value = guest.notes || '';
      } else {
        container.querySelector('#modal-title').textContent = "Ajouter un invité";
        form.reset();
        container.querySelector('#form-guest-id').value = '';
        container.querySelector('#form-seats').value = '1';
        container.querySelector('#form-status').value = 'draft';
      }
      modal.classList.remove('hidden');
    }

    function closeModal() {
      modal.classList.add('hidden');
    }

    // Modal close triggers
    container.querySelector('#modal-close-btn')?.addEventListener('click', closeModal);
    container.querySelector('#modal-cancel-btn')?.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });

    // Add guest trigger
    container.querySelector('#btn-add-guest')?.addEventListener('click', () => openModal());

    // Auto open modal if requested via params
    if (params.openAddModal) {
      openModal();
    }

    // Form submit
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const guestId = container.querySelector('#form-guest-id').value;
      const data = {
        name: container.querySelector('#form-name').value,
        phone: container.querySelector('#form-phone').value,
        email: container.querySelector('#form-email').value,
        category: container.querySelector('#form-category').value || 'Général',
        seats: parseInt(container.querySelector('#form-seats').value) || 1,
        table: container.querySelector('#form-table').value,
        status: container.querySelector('#form-status').value,
        notes: container.querySelector('#form-notes').value
      };

      if (guestId) {
        store.updateGuest(guestId, data);
        Utils.showToast('Invité mis à jour avec succès', 'success');
      } else {
        store.addGuest(data);
        Utils.showToast('Nouvel invité ajouté', 'success');
      }
      closeModal();
      renderList();
    });

    // Search and filter triggers
    container.querySelector('#search-input')?.addEventListener('input', (e) => {
      searchTerm = e.target.value;
      renderList();
    });

    container.querySelector('#filter-category')?.addEventListener('change', (e) => {
      selectedCategory = e.target.value;
      renderList();
    });

    container.querySelector('#filter-status')?.addEventListener('change', (e) => {
      selectedStatus = e.target.value;
      renderList();
    });

    // Export CSV
    container.querySelector('#btn-export-csv')?.addEventListener('click', () => {
      Utils.exportGuestsToCSV(store.guests);
      Utils.showToast('Export CSV téléchargé', 'success');
    });

    // Import CSV
    const fileInput = container.querySelector('#file-csv-input');
    container.querySelector('#btn-import-csv')?.addEventListener('click', () => {
      fileInput.click();
    });

    fileInput?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
        const parsed = Utils.parseCSVToGuests(evt.target.result);
        if (parsed.length > 0) {
          const count = store.importBatchGuests(parsed);
          Utils.showToast(`${count} invité(s) importé(s) avec succès !`, 'success');
          renderList();
        } else {
          Utils.showToast('Aucun invité valide trouvé dans ce fichier CSV', 'error');
        }
      };
      reader.readAsText(file);
      fileInput.value = '';
    });

    // Delegated edit/delete/status actions
    container.addEventListener('click', (e) => {
      const editBtn = e.target.closest('[data-action="edit"]');
      if (editBtn) {
        const id = editBtn.getAttribute('data-id');
        const guest = store.guests.find(g => g.id === id);
        if (guest) openModal(guest);
        return;
      }

      const delBtn = e.target.closest('[data-action="delete"]');
      if (delBtn) {
        const id = delBtn.getAttribute('data-id');
        const guest = store.guests.find(g => g.id === id);
        if (guest && confirm(`Supprimer définitivement "${guest.name}" de la liste ?`)) {
          store.deleteGuest(id);
          Utils.showToast('Invité supprimé', 'info');
          renderList();
        }
        return;
      }
    });

    container.addEventListener('change', (e) => {
      if (e.target.matches('[data-action="quick-status"]')) {
        const id = e.target.getAttribute('data-id');
        const status = e.target.value;
        store.updateStatus(id, status);
        Utils.showToast('Statut mis à jour', 'success');
        renderList();
      }
    });

    renderList();
  }, 0);

  return container;
}
