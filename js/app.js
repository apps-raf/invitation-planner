/**
 * InviTrack - Hierarchical Branch-First Invitation Tracker (v3)
 */

import { store } from './store.js';

class InvitationApp {
  constructor() {
    this.searchQuery = '';
    this.activeFilter = 'all'; // 'all', 'invited', 'pending', 'declined'
    this.activeCategory = 'all'; // 'all', 'Famille', 'Belle Famille', 'Amis', 'Voisins'
    this.activeBranch = 'all'; // 'all' or specific branch name
    this.viewMode = store.config.viewMode || 'grouped'; // 'grouped' | 'flat'
    this.collapsedGroups = new Set();
    this.allCollapsed = false;

    this.init();
  }

  init() {
    this.bindEvents();
    store.subscribe(() => this.render());
    this.render();
    this.initPWA();
  }

  initPWA() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(console.error);
    }
  }

  bindEvents() {
    // Search input
    const searchInput = document.getElementById('search-input');
    const clearSearchBtn = document.getElementById('btn-clear-search');

    searchInput?.addEventListener('input', (e) => {
      this.searchQuery = e.target.value;
      if (clearSearchBtn) {
        clearSearchBtn.style.display = this.searchQuery ? 'block' : 'none';
      }
      this.renderList();
    });

    clearSearchBtn?.addEventListener('click', () => {
      searchInput.value = '';
      this.searchQuery = '';
      clearSearchBtn.style.display = 'none';
      searchInput.focus();
      this.renderList();
    });

    // View Mode Toggle (Grouped vs Flat)
    document.getElementById('btn-toggle-view-mode')?.addEventListener('click', () => {
      this.viewMode = this.viewMode === 'grouped' ? 'flat' : 'grouped';
      store.saveConfig({ viewMode: this.viewMode });
      this.updateViewModeUI();
      this.renderList();
    });

    // Category Tabs (Tous, Famille, Belle Famille, Voisins, Amis)
    document.querySelectorAll('.cat-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        this.activeCategory = btn.getAttribute('data-cat');
        this.activeBranch = 'all'; // reset sub-branch
        document.querySelectorAll('.cat-pill').forEach(b => {
          b.classList.remove('bg-indigo-600', 'text-white', 'shadow-md');
          b.classList.add('bg-slate-800/80', 'text-slate-400');
        });
        btn.classList.remove('bg-slate-800/80', 'text-slate-400');
        btn.classList.add('bg-indigo-600', 'text-white', 'shadow-md');

        this.renderBranchChips();
        this.renderList();
      });
    });

    // Status Sub-filter pills (Tous, Invités, À décider, Écartés)
    document.querySelectorAll('.filter-status-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        this.activeFilter = btn.getAttribute('data-filter');
        document.querySelectorAll('.filter-status-pill').forEach(b => {
          b.classList.remove('bg-slate-800', 'text-white', 'font-bold');
          b.classList.add('text-slate-400');
        });
        btn.classList.add('bg-slate-800', 'text-white', 'font-bold');
        btn.classList.remove('text-slate-400');
        this.renderList();
      });
    });

    // Toggle Collapse / Expand all groups
    document.getElementById('btn-collapse-all')?.addEventListener('click', () => {
      this.allCollapsed = !this.allCollapsed;
      const groups = this.getGroupKeys();
      if (this.allCollapsed) {
        groups.forEach(g => this.collapsedGroups.add(g));
      } else {
        this.collapsedGroups.clear();
      }
      this.renderList();
    });

    // Add Person Modal
    const addModal = document.getElementById('add-modal');
    const addForm = document.getElementById('add-form');
    document.getElementById('btn-open-add')?.addEventListener('click', () => {
      document.getElementById('add-name-input').value = this.searchQuery.trim();
      addModal.classList.remove('hidden');
      setTimeout(() => document.getElementById('add-name-input').focus(), 100);
    });

    document.getElementById('btn-close-add')?.addEventListener('click', () => {
      addModal.classList.add('hidden');
    });

    addForm?.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('add-name-input').value;
      const category = document.getElementById('add-category-input').value || 'Famille';
      const branch = document.getElementById('add-branch-input').value || '';
      const gender = document.getElementById('add-gender-input').value || '';
      const comment = document.getElementById('add-comment-input').value || '';

      store.addPerson(name, category, branch, gender, comment);
      addModal.classList.add('hidden');
      addForm.reset();
      this.showToast(`"${name}" ajouté !`, 'success');
    });

    // Decline / Comment modal
    const declineModal = document.getElementById('decline-modal');
    const declineForm = document.getElementById('decline-form');
    let currentDeclineId = null;

    document.getElementById('btn-close-decline')?.addEventListener('click', () => {
      declineModal.classList.add('hidden');
    });

    declineForm?.addEventListener('submit', (e) => {
      e.preventDefault();
      const comment = document.getElementById('decline-comment-input').value;
      if (currentDeclineId) {
        store.markDeclined(currentDeclineId, comment);
        this.showToast('Marqué comme "Non invité"', 'info');
      }
      declineModal.classList.add('hidden');
      declineForm.reset();
    });

    // Preset reasons
    document.querySelectorAll('.preset-reason').forEach(tag => {
      tag.addEventListener('click', () => {
        document.getElementById('decline-comment-input').value = tag.getAttribute('data-reason');
      });
    });

    // Google Sheets Modal & Reset
    const gsheetModal = document.getElementById('gsheet-modal');
    document.getElementById('btn-open-gsheet')?.addEventListener('click', () => {
      gsheetModal.classList.remove('hidden');
    });
    document.getElementById('btn-close-gsheet')?.addEventListener('click', () => {
      gsheetModal.classList.add('hidden');
    });

    document.getElementById('btn-reset-list')?.addEventListener('click', () => {
      if (confirm('Recharger la liste des 257 personnes du fichier d\'origine ?')) {
        store.resetToInitialList();
        this.showToast('Liste des 257 personnes rechargée !', 'success');
        gsheetModal.classList.add('hidden');
      }
    });

    // Delegated actions (Clicks on list items and headers)
    document.getElementById('people-list')?.addEventListener('click', (e) => {
      // Toggle collapse on branch header
      const headerBtn = e.target.closest('[data-action="toggle-group"]');
      if (headerBtn) {
        const groupKey = headerBtn.getAttribute('data-group-key');
        if (this.collapsedGroups.has(groupKey)) {
          this.collapsedGroups.delete(groupKey);
        } else {
          this.collapsedGroups.add(groupKey);
        }
        this.renderList();
        return;
      }

      // Batch Invite entire branch
      const batchInviteBtn = e.target.closest('[data-action="batch-invite"]');
      if (batchInviteBtn) {
        e.stopPropagation();
        const idsStr = batchInviteBtn.getAttribute('data-ids');
        const ids = idsStr ? idsStr.split(',') : [];
        if (ids.length > 0) {
          const count = store.markBatchInvited(ids);
          this.showToast(`🟢 ${count} personnes de la branche marquées comme invitées !`, 'success');
        }
        return;
      }

      // Batch Reset branch
      const batchResetBtn = e.target.closest('[data-action="batch-pending"]');
      if (batchResetBtn) {
        e.stopPropagation();
        const idsStr = batchResetBtn.getAttribute('data-ids');
        const ids = idsStr ? idsStr.split(',') : [];
        if (ids.length > 0) {
          store.markBatchPending(ids);
          this.showToast('Branche remise à "À décider"', 'info');
        }
        return;
      }

      // 1-Click: Mark Invited
      const btnInvite = e.target.closest('[data-action="mark-invited"]');
      if (btnInvite) {
        const id = btnInvite.getAttribute('data-id');
        store.markInvited(id);
        if ('vibrate' in navigator) navigator.vibrate(25);
        this.showToast('Coché : Invité !', 'success');
        return;
      }

      // Mark Declined (open modal)
      const btnDecline = e.target.closest('[data-action="open-decline"]');
      if (btnDecline) {
        currentDeclineId = btnDecline.getAttribute('data-id');
        const person = store.people.find(p => p.id === currentDeclineId);
        document.getElementById('decline-name-label').textContent = person ? person.name : '';
        document.getElementById('decline-comment-input').value = person ? person.comment || '' : '';
        declineModal.classList.remove('hidden');
        setTimeout(() => document.getElementById('decline-comment-input').focus(), 100);
        return;
      }

      // Mark Pending
      const btnPending = e.target.closest('[data-action="mark-pending"]');
      if (btnPending) {
        const id = btnPending.getAttribute('data-id');
        store.markPending(id);
        this.showToast('Remis à "À décider"', 'info');
        return;
      }

      // Quick Delete
      const btnDelete = e.target.closest('[data-action="delete"]');
      if (btnDelete) {
        const id = btnDelete.getAttribute('data-id');
        const person = store.people.find(p => p.id === id);
        if (person && confirm(`Supprimer "${person.name}" ?`)) {
          store.deletePerson(id);
          this.showToast('Personne retirée', 'info');
        }
        return;
      }
    });
  }

  updateViewModeUI() {
    const icon = document.getElementById('view-mode-icon');
    const label = document.getElementById('view-mode-label');
    if (this.viewMode === 'grouped') {
      icon.textContent = '📂';
      label.textContent = 'Vue Branches';
    } else {
      icon.textContent = '📜';
      label.textContent = 'Vue Liste';
    }
  }

  getFilteredPeople() {
    const { people } = store.getSnapshot();
    const query = this.searchQuery.toLowerCase().trim();

    return people.filter(p => {
      const matchSearch = !query ||
        p.name.toLowerCase().includes(query) ||
        (p.branch && p.branch.toLowerCase().includes(query)) ||
        (p.category && p.category.toLowerCase().includes(query)) ||
        (p.comment && p.comment.toLowerCase().includes(query));

      const matchCategory = this.activeCategory === 'all' || p.category === this.activeCategory;
      const matchBranch = this.activeBranch === 'all' || p.branch === this.activeBranch;
      const matchStatus = this.activeFilter === 'all' || p.status === this.activeFilter;

      return matchSearch && matchCategory && matchBranch && matchStatus;
    });
  }

  getGroupKeys() {
    const filtered = this.getFilteredPeople();
    const keys = new Set();
    filtered.forEach(p => {
      const key = p.category === 'Famille' 
        ? `Famille - ${p.branch || 'Autres membres'}`
        : p.category;
      keys.add(key);
    });
    return Array.from(keys);
  }

  renderBranchChips() {
    const container = document.getElementById('branch-chips-container');
    if (!container) return;

    const { branches, people } = store.getSnapshot();

    if (this.activeCategory !== 'Famille' && this.activeCategory !== 'all') {
      container.classList.add('hidden');
      return;
    }

    container.classList.remove('hidden');

    // Get sorted branches by count
    const branchEntries = Object.entries(branches).sort((a, b) => b[1] - a[1]);

    const chipsHtml = `
      <span class="text-[11px] font-semibold text-slate-400 shrink-0 self-center mr-1">Branches :</span>
      <button data-branch="all" class="branch-chip px-2.5 py-1 rounded-lg text-[11px] font-bold transition shrink-0 ${
        this.activeBranch === 'all' ? 'bg-indigo-600 text-white' : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
      }">
        Toutes (${people.filter(p => p.category === 'Famille').length})
      </button>
      ${branchEntries.map(([branch, count]) => `
        <button data-branch="${this.escapeAttr(branch)}" class="branch-chip px-2.5 py-1 rounded-lg text-[11px] font-medium transition shrink-0 ${
          this.activeBranch === branch ? 'bg-indigo-600 text-white font-bold' : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
        }">
          ${this.escapeHtml(branch)} (${count})
        </button>
      `).join('')}
    `;

    container.innerHTML = chipsHtml;

    container.querySelectorAll('.branch-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        this.activeBranch = btn.getAttribute('data-branch');
        this.renderBranchChips();
        this.renderList();
      });
    });
  }

  render() {
    const { counts, categories } = store.getSnapshot();

    // Top counts
    document.getElementById('count-total').textContent = counts.total;
    document.getElementById('count-invited').textContent = counts.invited;
    document.getElementById('count-pending').textContent = counts.pending;
    document.getElementById('count-declined').textContent = counts.declined;

    // Secondary statistics
    document.getElementById('stat-famille').textContent = `Famille: ${categories['Famille'] || 0}`;
    document.getElementById('stat-voisins').textContent = `Voisins: ${categories['Voisins'] || 0}`;
    document.getElementById('stat-amis').textContent = `Amis: ${categories['Amis'] || 0}`;
    document.getElementById('stat-femmes').textContent = `👩 ${counts.femmes} F`;
    document.getElementById('stat-hommes').textContent = `👨 ${counts.hommes} H`;

    // Category pills badges
    document.getElementById('cat-badge-all').textContent = counts.total;
    document.getElementById('cat-badge-famille').textContent = categories['Famille'] || 0;
    document.getElementById('cat-badge-voisins').textContent = categories['Voisins'] || 0;
    document.getElementById('cat-badge-amis').textContent = categories['Amis'] || 0;

    this.updateViewModeUI();
    this.renderBranchChips();
    this.renderList();
  }

  renderList() {
    const filtered = this.getFilteredPeople();
    const container = document.getElementById('people-list');
    const query = this.searchQuery.trim();

    if (filtered.length === 0) {
      if (query) {
        container.innerHTML = `
          <div class="glass-panel rounded-2xl p-6 text-center border border-indigo-500/30 animate-fade-in my-4">
            <p class="text-sm text-slate-300">Aucun résultat pour <span class="text-white font-bold">"${this.escapeHtml(query)}"</span></p>
            <button id="btn-quick-add-from-search" class="mt-3 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/30 transition inline-flex items-center gap-2">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
              Ajouter "${this.escapeHtml(query)}"
            </button>
          </div>
        `;
        document.getElementById('btn-quick-add-from-search')?.addEventListener('click', () => {
          document.getElementById('btn-open-add').click();
        });
      } else {
        container.innerHTML = `
          <div class="p-12 text-center text-slate-500">
            <p class="text-sm font-medium text-slate-400">Aucun invité trouvé avec ces filtres</p>
          </div>
        `;
      }
      return;
    }

    // 1. Grouped / Hierarchical View
    if (this.viewMode === 'grouped') {
      const groupsMap = new Map();

      filtered.forEach(p => {
        let groupTitle = '';
        let groupType = 'cat';

        if (p.category === 'Famille') {
          groupTitle = p.branch ? `Branche ${p.branch}` : 'Famille Ourahmoune (Autres membres)';
          groupType = 'branch';
        } else if (p.category === 'Voisins') {
          groupTitle = 'Voisins';
        } else if (p.category === 'Amis') {
          groupTitle = 'Amis';
        } else {
          groupTitle = p.category;
        }

        if (!groupsMap.has(groupTitle)) {
          groupsMap.set(groupTitle, []);
        }
        groupsMap.get(groupTitle).push(p);
      });

      container.innerHTML = Array.from(groupsMap.entries()).map(([title, members]) => {
        const isCollapsed = this.collapsedGroups.has(title) && !query;
        const invitedCount = members.filter(m => m.status === 'invited').length;
        const pendingCount = members.filter(m => m.status === 'pending').length;
        const declinedCount = members.filter(m => m.status === 'declined').length;
        const memberIds = members.map(m => m.id).join(',');

        return `
          <div class="glass-panel rounded-2xl border border-slate-800/80 overflow-hidden shadow-lg transition">
            <!-- Group Header -->
            <div data-action="toggle-group" data-group-key="${this.escapeAttr(title)}" class="p-3.5 bg-slate-900/90 hover:bg-slate-900 border-b border-slate-800 flex items-center justify-between gap-3 cursor-pointer select-none">
              <div class="flex items-center gap-2.5 min-w-0">
                <span class="text-base">${isCollapsed ? '▶' : '▼'}</span>
                <div>
                  <h3 class="font-bold text-white text-sm truncate flex items-center gap-2">
                    <span>${this.escapeHtml(title)}</span>
                    <span class="text-xs font-normal text-slate-400">(${members.length} pers.)</span>
                  </h3>
                  <!-- Sub-counts -->
                  <div class="flex items-center gap-2 text-[11px] mt-0.5">
                    ${invitedCount > 0 ? `<span class="text-emerald-400 font-semibold">🟢 ${invitedCount} invité(s)</span>` : ''}
                    ${pendingCount > 0 ? `<span class="text-amber-400">🟡 ${pendingCount} à décider</span>` : ''}
                    ${declinedCount > 0 ? `<span class="text-rose-400">🔴 ${declinedCount} écarté(s)</span>` : ''}
                  </div>
                </div>
              </div>

              <!-- Quick Bulk Action Button -->
              <div class="flex items-center gap-1.5 shrink-0">
                ${pendingCount > 0 ? `
                  <button data-action="batch-invite" data-ids="${memberIds}" class="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 transition flex items-center gap-1" title="Inviter toute la branche">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>
                    <span>Tout inviter</span>
                  </button>
                ` : `
                  <span class="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    Complété ✓
                  </span>
                `}
              </div>
            </div>

            <!-- Group Cards -->
            ${!isCollapsed ? `
              <div class="p-2.5 space-y-2.5 bg-slate-950/40">
                ${members.map(person => this.renderPersonCard(person)).join('')}
              </div>
            ` : ''}
          </div>
        `;
      }).join('');

    } else {
      // 2. Flat Continuous View
      container.innerHTML = filtered.map(person => this.renderPersonCard(person)).join('');
    }
  }

  renderPersonCard(person) {
    const isInvited = person.status === 'invited';
    const isDeclined = person.status === 'declined';
    const isPending = !isInvited && !isDeclined;

    const dateStr = person.invitedAt ? new Date(person.invitedAt).toLocaleDateString('fr-FR', {
      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
    }) : null;

    return `
      <div class="glass-card rounded-2xl p-3.5 border transition ${
        isInvited ? 'border-emerald-500/40 bg-emerald-950/20' :
        isDeclined ? 'border-rose-500/20 bg-rose-950/15 opacity-75' :
        'border-slate-800/80 bg-slate-900/60'
      } flex flex-col gap-2.5">

        <!-- Top Row: Name, Gender & Branch -->
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <h4 class="font-bold text-white text-base truncate">${this.escapeHtml(person.name)}</h4>
              
              <!-- Gender Badge -->
              ${person.gender ? `
                <span class="px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                  person.gender === 'F' ? 'bg-pink-500/20 text-pink-300 border border-pink-500/30' : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                }">
                  ${person.gender === 'F' ? '👩 Femme' : '👨 Homme'}
                </span>
              ` : ''}

              <!-- Branch Badge (if in flat view or different category) -->
              ${person.branch ? `
                <span class="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-800 text-slate-300 border border-slate-700">
                  🏷️ ${this.escapeHtml(person.branch)}
                </span>
              ` : ''}
            </div>

            <!-- Status & Comment details -->
            <div class="mt-1 text-xs flex flex-wrap items-center gap-x-2 gap-y-1">
              ${isInvited && dateStr ? `
                <span class="text-emerald-400 font-semibold flex items-center gap-1 text-[11px]">
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                  Invité le ${dateStr}
                </span>
              ` : ''}

              ${isDeclined ? `
                <span class="text-rose-400 font-medium text-[11px]">❌ Non invité</span>
              ` : ''}

              ${isPending ? `
                <span class="text-amber-400/90 text-[11px]">⏳ À décider</span>
              ` : ''}

              ${person.comment ? `
                <span class="text-slate-400 italic text-[11px] bg-slate-800/80 px-2 py-0.5 rounded">
                  💬 ${this.escapeHtml(person.comment)}
                </span>
              ` : ''}
            </div>
          </div>

          <!-- Quick Delete -->
          <button data-action="delete" data-id="${person.id}" class="text-slate-500 hover:text-rose-400 p-1 rounded-lg transition" title="Supprimer">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
          </button>
        </div>

        <!-- 3-Pill Toggle -->
        <div class="grid grid-cols-3 gap-1.5 pt-1.5 border-t border-slate-800/80">
          <!-- 1. INVITÉ -->
          <button data-action="mark-invited" data-id="${person.id}" class="py-1.5 px-1 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1 ${
            isInvited
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
              : 'bg-slate-800/90 hover:bg-slate-700 text-slate-300 border border-slate-700/60'
          }">
            <svg class="w-3.5 h-3.5 ${isInvited ? 'text-white' : 'text-emerald-400'}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>
            <span>Invité</span>
          </button>

          <!-- 2. À DÉCIDER -->
          <button data-action="mark-pending" data-id="${person.id}" class="py-1.5 px-1 text-xs font-medium rounded-xl transition flex items-center justify-center gap-1 ${
            isPending
              ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30 font-bold'
              : 'bg-slate-800/90 hover:bg-slate-700 text-slate-300 border border-slate-700/60'
          }">
            <span>À décider</span>
          </button>

          <!-- 3. ÉCARTER -->
          <button data-action="open-decline" data-id="${person.id}" class="py-1.5 px-1 text-xs font-medium rounded-xl transition flex items-center justify-center gap-1 ${
            isDeclined
              ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30 font-bold'
              : 'bg-slate-800/90 hover:bg-slate-700 text-slate-300 border border-slate-700/60'
          }">
            <svg class="w-3.5 h-3.5 ${isDeclined ? 'text-white' : 'text-rose-400'}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
            <span>Écarter</span>
          </button>
        </div>
      </div>
    `;
  }

  escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  escapeAttr(str) {
    if (!str) return '';
    return String(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  showToast(message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'fixed top-4 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    const colors = {
      success: 'bg-emerald-600',
      error: 'bg-rose-600',
      info: 'bg-indigo-600',
      warning: 'bg-amber-600'
    };

    toast.className = `${colors[type] || colors.info} text-white px-4 py-2.5 rounded-2xl shadow-2xl text-xs font-semibold text-center animate-fade-in pointer-events-auto border border-white/10`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 2800);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.inviApp = new InvitationApp();
});
