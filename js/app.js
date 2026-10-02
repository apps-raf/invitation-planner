/**
 * InviTrack - Main Application
 * Features: Multi-Manager Auth (PIN), Cloud Supabase Sync, Real-time Activity Log & 1-Click Undo
 */

import { store } from './store.js';
import {
  getCurrentManager,
  setCurrentManager,
  verifyAndLogin,
  updateManagerPin,
  fetchAuditLogs,
  fetchManagers
} from './supabaseClient.js';

class InvitationApp {
  constructor() {
    this.searchQuery = '';
    this.activeFilter = 'all'; // 'all', 'invited', 'pending', 'declined'
    this.activeCategory = 'all'; // 'all', 'Famille', 'Belle Famille', 'Voisins', 'Amis'
    this.activeBranch = 'all'; // 'all' or specific branch name
    this.viewMode = store.config.viewMode || 'grouped'; // 'grouped' | 'flat'
    this.collapsedGroups = new Set();
    this.allCollapsed = false;

    // Auth & Manager state
    this.currentManager = getCurrentManager();
    this.selectedAuthProfile = 'rafik';
    this.activeHistoryFilter = 'all';

    this.init();
  }

  init() {
    this.bindEvents();
    this.bindAuthEvents();
    this.bindHistoryEvents();

    store.subscribe(() => this.render());
    store.onAuditUpdate(() => {
      const historyModal = document.getElementById('history-modal');
      if (historyModal && !historyModal.classList.contains('hidden')) {
        this.renderHistoryList();
      }
    });

    this.checkInitialAuth();
    this.render();
    this.initPWA();
  }

  initPWA() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(console.error);
    }
  }

  // --- Auth & PIN Handlers ---

  checkInitialAuth() {
    this.updateUserHeaderUI();
    if (!this.currentManager) {
      this.showLoginModal();
    } else if (this.currentManager.mustChangePin) {
      this.showChangePinModal(true);
    }
  }

  updateUserHeaderUI() {
    const nameEl = document.getElementById('header-user-name');
    const dotEl = document.getElementById('cloud-status-dot');

    if (this.currentManager) {
      if (nameEl) nameEl.textContent = this.currentManager.name;
    } else {
      if (nameEl) nameEl.textContent = 'Connexion';
    }

    if (dotEl) {
      dotEl.className = `absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full ${
        store.cloudConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
      } ring-2 ring-slate-950`;
      dotEl.title = store.cloudConnected ? 'Connecté à Supabase en direct' : 'Mode local / Connexion...';
    }
  }

  showLoginModal() {
    const authModal = document.getElementById('auth-modal');
    const stepLogin = document.getElementById('auth-step-login');
    const stepChange = document.getElementById('auth-step-changepin');
    const pinInput = document.getElementById('auth-pin-input');
    const errorEl = document.getElementById('auth-error-msg');

    if (errorEl) errorEl.classList.add('hidden');
    if (pinInput) pinInput.value = '';

    stepLogin?.classList.remove('hidden');
    stepChange?.classList.add('hidden');
    authModal?.classList.remove('hidden');

    this.updateProfileSelectionUI();
    setTimeout(() => pinInput?.focus(), 150);
  }

  showChangePinModal(isMandatory = false) {
    const authModal = document.getElementById('auth-modal');
    const stepLogin = document.getElementById('auth-step-login');
    const stepChange = document.getElementById('auth-step-changepin');
    const newPinInput = document.getElementById('new-pin-input');
    const confirmPinInput = document.getElementById('confirm-pin-input');
    const errorEl = document.getElementById('changepin-error-msg');
    const subtitle = document.getElementById('changepin-subtitle');

    if (errorEl) errorEl.classList.add('hidden');
    if (newPinInput) newPinInput.value = '';
    if (confirmPinInput) confirmPinInput.value = '';

    if (subtitle) {
      subtitle.textContent = isMandatory
        ? 'Première connexion détectée avec le code par défaut (0000). Veuillez définir votre code PIN secret à 4 chiffres.'
        : 'Saisissez votre nouveau code PIN secret à 4 chiffres.';
    }

    stepLogin?.classList.add('hidden');
    stepChange?.classList.remove('hidden');
    authModal?.classList.remove('hidden');

    setTimeout(() => newPinInput?.focus(), 150);
  }

  updateProfileSelectionUI() {
    document.querySelectorAll('.auth-profile-btn').forEach(btn => {
      const p = btn.getAttribute('data-profile');
      if (p === this.selectedAuthProfile) {
        btn.classList.add('border-indigo-500', 'bg-indigo-600/10', 'text-white');
        btn.classList.remove('border-slate-800', 'bg-slate-800/40', 'text-slate-400');
      } else {
        btn.classList.remove('border-indigo-500', 'bg-indigo-600/10', 'text-white');
        btn.classList.add('border-slate-800', 'bg-slate-800/40', 'text-slate-400');
      }
    });
  }

  bindAuthEvents() {
    const authModal = document.getElementById('auth-modal');
    const pinInput = document.getElementById('auth-pin-input');
    const btnSubmitLogin = document.getElementById('btn-submit-login');
    const errorEl = document.getElementById('auth-error-msg');

    // Profile buttons toggle
    document.querySelectorAll('.auth-profile-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.selectedAuthProfile = btn.getAttribute('data-profile') || 'rafik';
        this.updateProfileSelectionUI();
        if (pinInput) {
          pinInput.value = '';
          pinInput.focus();
        }
        if (errorEl) errorEl.classList.add('hidden');
      });
    });

    // Enter key submits PIN
    pinInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        btnSubmitLogin?.click();
      }
    });

    // Submit PIN Login
    btnSubmitLogin?.addEventListener('click', async () => {
      const pin = pinInput ? pinInput.value.trim() : '';
      if (!pin || pin.length !== 4) {
        if (errorEl) {
          errorEl.textContent = 'Veuillez saisir un code à 4 chiffres';
          errorEl.classList.remove('hidden');
        }
        return;
      }

      btnSubmitLogin.disabled = true;
      btnSubmitLogin.innerHTML = '<span>Vérification...</span>';

      const res = await verifyAndLogin(this.selectedAuthProfile, pin);
      btnSubmitLogin.disabled = false;
      btnSubmitLogin.innerHTML = '<span>Déverrouiller</span><span>➜</span>';

      if (!res.success) {
        if (errorEl) {
          errorEl.textContent = res.message || 'Code PIN incorrect';
          errorEl.classList.remove('hidden');
        }
        if (pinInput) {
          pinInput.value = '';
          pinInput.focus();
        }
        return;
      }

      this.currentManager = res.manager;
      this.updateUserHeaderUI();

      if (res.mustChangePin) {
        this.showChangePinModal(true);
      } else {
        authModal.classList.add('hidden');
        this.showToast(`Bienvenue ${this.currentManager.name} !`, 'success');
      }
    });

    // Save New PIN Handler
    const btnSaveNewPin = document.getElementById('btn-save-new-pin');
    const newPinInput = document.getElementById('new-pin-input');
    const confirmPinInput = document.getElementById('confirm-pin-input');
    const changepinError = document.getElementById('changepin-error-msg');

    btnSaveNewPin?.addEventListener('click', async () => {
      const newPin = newPinInput ? newPinInput.value.trim() : '';
      const confirmPin = confirmPinInput ? confirmPinInput.value.trim() : '';

      if (!newPin || newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
        if (changepinError) {
          changepinError.textContent = 'Le code doit contenir exactement 4 chiffres';
          changepinError.classList.remove('hidden');
        }
        return;
      }

      if (newPin === '0000') {
        if (changepinError) {
          changepinError.textContent = 'Le code 0000 est interdit. Choisissez un autre code.';
          changepinError.classList.remove('hidden');
        }
        return;
      }

      if (newPin !== confirmPin) {
        if (changepinError) {
          changepinError.textContent = 'Les deux codes ne correspondent pas';
          changepinError.classList.remove('hidden');
        }
        return;
      }

      if (!this.currentManager) return;

      btnSaveNewPin.disabled = true;
      btnSaveNewPin.textContent = 'Enregistrement...';

      const res = await updateManagerPin(this.currentManager.id, newPin);
      btnSaveNewPin.disabled = false;
      btnSaveNewPin.textContent = 'Enregistrer et continuer';

      if (!res.success) {
        if (changepinError) {
          changepinError.textContent = res.message || 'Erreur lors de la mise à jour';
          changepinError.classList.remove('hidden');
        }
        return;
      }

      this.currentManager.mustChangePin = false;
      authModal.classList.add('hidden');
      this.showToast('Nouveau code PIN enregistré !', 'success');
    });

    // User Profile Menu Modal
    const userModal = document.getElementById('user-modal');
    document.getElementById('btn-user-profile')?.addEventListener('click', () => {
      if (!this.currentManager) {
        this.showLoginModal();
        return;
      }
      document.getElementById('user-modal-name').textContent = this.currentManager.name;
      userModal.classList.remove('hidden');
    });

    document.getElementById('btn-close-user')?.addEventListener('click', () => {
      userModal.classList.add('hidden');
    });

    document.getElementById('btn-trigger-change-pin')?.addEventListener('click', () => {
      userModal.classList.add('hidden');
      this.showChangePinModal(false);
    });

    document.getElementById('btn-switch-user')?.addEventListener('click', () => {
      userModal.classList.add('hidden');
      setCurrentManager(null);
      this.currentManager = null;
      this.updateUserHeaderUI();
      this.showLoginModal();
    });
  }

  // --- History & Audit Log Handlers ---

  bindHistoryEvents() {
    const historyModal = document.getElementById('history-modal');
    const btnOpenHistory = document.getElementById('btn-open-history');
    const btnCloseHistory = document.getElementById('btn-close-history');

    btnOpenHistory?.addEventListener('click', () => {
      historyModal.classList.remove('hidden');
      this.renderHistoryList();
    });

    btnCloseHistory?.addEventListener('click', () => {
      historyModal.classList.add('hidden');
    });

    // Filter pills in history modal
    document.querySelectorAll('.history-filter-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        this.activeHistoryFilter = btn.getAttribute('data-history-filter') || 'all';
        document.querySelectorAll('.history-filter-pill').forEach(b => {
          b.classList.remove('bg-amber-500/20', 'text-amber-300', 'font-bold', 'border', 'border-amber-500/30');
          b.classList.add('text-slate-400');
        });
        btn.classList.add('bg-amber-500/20', 'text-amber-300', 'font-bold', 'border', 'border-amber-500/30');
        btn.classList.remove('text-slate-400');
        this.renderHistoryList();
      });
    });

    // 1-Click Undo delegation
    document.getElementById('history-list')?.addEventListener('click', async (e) => {
      const btnUndo = e.target.closest('[data-action="undo-log"]');
      if (!btnUndo) return;

      const logId = btnUndo.getAttribute('data-log-id');
      if (!logId) return;

      btnUndo.disabled = true;
      btnUndo.textContent = 'Annulation...';

      const res = await store.undoAction(logId);
      if (res.success) {
        this.showToast(`↩ Modification de ${res.guestName} annulée !`, 'info');
        this.renderHistoryList();
      } else {
        this.showToast(res.message || 'Impossible d\'annuler', 'error');
        btnUndo.disabled = false;
        btnUndo.textContent = '↩ Annuler';
      }
    });
  }

  async renderHistoryList() {
    const container = document.getElementById('history-list');
    if (!container) return;

    container.innerHTML = `
      <div class="py-6 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
        <span class="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
        <span>Chargement du journal Cloud...</span>
      </div>
    `;

    const logs = await fetchAuditLogs(60);
    const filteredLogs = logs.filter(log => {
      if (this.activeHistoryFilter === 'all') return true;
      return (log.manager_name || '').toLowerCase() === this.activeHistoryFilter.toLowerCase();
    });

    if (filteredLogs.length === 0) {
      container.innerHTML = `
        <div class="py-10 text-center text-xs text-slate-500">
          Aucune modification enregistrée pour le moment.
        </div>
      `;
      return;
    }

    container.innerHTML = filteredLogs.map(log => {
      const isUndone = log.undone;
      const date = new Date(log.created_at);
      const timeStr = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      const dateStr = date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
      const author = log.manager_name || 'Anonyme';

      let actionDesc = '';
      let actionBadge = '';

      if (log.action_type === 'invited') {
        actionBadge = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
        actionDesc = `A marqué <strong class="text-white">${this.escapeHtml(log.guest_name)}</strong> comme <span class="text-emerald-400 font-semibold">Invité</span>`;
      } else if (log.action_type === 'declined') {
        actionBadge = 'bg-rose-500/20 text-rose-300 border-rose-500/30';
        const reason = log.new_comment ? `(Motif: ${this.escapeHtml(log.new_comment)})` : '';
        actionDesc = `A <span class="text-rose-400 font-semibold">écarté</span> <strong class="text-white">${this.escapeHtml(log.guest_name)}</strong> ${reason}`;
      } else if (log.action_type === 'pending') {
        actionBadge = 'bg-amber-500/20 text-amber-300 border-amber-500/30';
        actionDesc = `A remis <strong class="text-white">${this.escapeHtml(log.guest_name)}</strong> à <span class="text-amber-400 font-semibold">À décider</span>`;
      } else if (log.action_type === 'add') {
        actionBadge = 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30';
        actionDesc = `A <span class="text-indigo-400 font-semibold">ajouté</span> <strong class="text-white">${this.escapeHtml(log.guest_name)}</strong>`;
      } else if (log.action_type === 'delete') {
        actionBadge = 'bg-slate-700 text-slate-300 border-slate-600';
        actionDesc = `A supprimé <strong class="text-white">${this.escapeHtml(log.guest_name)}</strong>`;
      } else {
        actionBadge = 'bg-slate-800 text-slate-400 border-slate-700';
        actionDesc = `Action ${log.action_type} sur <strong class="text-white">${this.escapeHtml(log.guest_name)}</strong>`;
      }

      return `
        <div class="p-2.5 rounded-xl border ${isUndone ? 'bg-slate-900/40 border-slate-800/50 opacity-60' : 'bg-slate-800/60 border-slate-700/60'} text-xs space-y-1 transition">
          <div class="flex items-center justify-between gap-2">
            <!-- Manager Badge + Timestamp -->
            <div class="flex items-center gap-1.5 min-w-0">
              <span class="px-1.5 py-0.5 rounded text-[10px] font-extrabold capitalize border ${actionBadge}">
                👤 ${this.escapeHtml(author)}
              </span>
              <span class="text-[10px] text-slate-400 truncate">
                ${dateStr} à ${timeStr}
              </span>
            </div>

            <!-- Undo Button or Undone Indicator -->
            <div class="shrink-0">
              ${isUndone ? `
                <span class="text-[10px] text-slate-500 italic line-through">
                  Annulé par ${this.escapeHtml(log.undone_by || 'Gestionnaire')}
                </span>
              ` : `
                <button data-action="undo-log" data-log-id="${log.id}" class="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 transition flex items-center gap-1">
                  <span>↩</span>
                  <span>Annuler</span>
                </button>
              `}
            </div>
          </div>

          <!-- Action Description -->
          <div class="text-[11px] text-slate-300 pl-0.5 leading-snug">
            ${actionDesc}
          </div>
        </div>
      `;
    }).join('');
  }

  // --- Main Events Binding ---

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
        this.activeBranch = 'all';
        document.querySelectorAll('.cat-pill').forEach(b => {
          b.classList.remove('bg-indigo-600', 'text-white', 'shadow-sm', 'font-bold');
          b.classList.add('bg-slate-900', 'text-slate-400');
        });
        btn.classList.remove('bg-slate-900', 'text-slate-400');
        btn.classList.add('bg-indigo-600', 'text-white', 'shadow-sm', 'font-bold');

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
        document.getElementById('btn-collapse-all').textContent = 'Tout déplier';
      } else {
        this.collapsedGroups.clear();
        document.getElementById('btn-collapse-all').textContent = 'Tout replier';
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

    document.querySelectorAll('.preset-reason').forEach(btn => {
      btn.addEventListener('click', () => {
        const input = document.getElementById('decline-comment-input');
        input.value = btn.getAttribute('data-reason') || '';
      });
    });

    declineForm?.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!currentDeclineId) return;
      const comment = document.getElementById('decline-comment-input').value;
      store.markDeclined(currentDeclineId, comment);
      declineModal.classList.add('hidden');
      this.showToast('Marqué comme écarté', 'warning');
    });

    // Reset button in gsheet modal
    document.getElementById('btn-reset-list')?.addEventListener('click', () => {
      if (confirm('Recharger la liste des 257 personnes du fichier d\'origine ?')) {
        store.resetToDefault();
        this.showToast('Liste des 257 personnes réinitialisée !', 'success');
      }
    });

    // =========================================================================
    // DELEGATED ACTIONS ON PEOPLE LIST
    // NOTE: Batch invite MUST be checked FIRST to avoid being swallowed by toggle-group!
    // =========================================================================
    document.getElementById('people-list')?.addEventListener('click', (e) => {
      // 1. Batch Invite entire branch (FIX: Handled BEFORE toggle-group!)
      const batchInviteBtn = e.target.closest('[data-action="batch-invite"]');
      if (batchInviteBtn) {
        e.stopPropagation();
        e.preventDefault();
        const idsStr = batchInviteBtn.getAttribute('data-ids');
        const ids = idsStr ? idsStr.split(',').filter(Boolean) : [];
        if (ids.length > 0) {
          const count = store.markBatchInvited(ids);
          this.showToast(`🟢 ${count} personnes de la branche invitées !`, 'success');
        }
        return;
      }

      // 2. Toggle collapse on branch header (ignore if clicked on button)
      const headerBtn = e.target.closest('[data-action="toggle-group"]');
      if (headerBtn) {
        if (e.target.closest('button')) return;
        const groupKey = headerBtn.getAttribute('data-group-key');
        if (this.collapsedGroups.has(groupKey)) {
          this.collapsedGroups.delete(groupKey);
        } else {
          this.collapsedGroups.add(groupKey);
        }
        this.renderList();
        return;
      }

      // 3. 1-Click: Mark Invited
      const btnInvite = e.target.closest('[data-action="mark-invited"]');
      if (btnInvite) {
        const id = btnInvite.getAttribute('data-id');
        store.markInvited(id);
        if ('vibrate' in navigator) navigator.vibrate(25);
        this.showToast('Coché : Invité !', 'success');
        return;
      }

      // 4. Mark Declined (open modal)
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

      // 5. Mark Pending
      const btnPending = e.target.closest('[data-action="mark-pending"]');
      if (btnPending) {
        const id = btnPending.getAttribute('data-id');
        store.markPending(id);
        this.showToast('Remis à "À décider"', 'info');
        return;
      }

      // 6. Quick Delete
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
      if (icon) icon.textContent = '📂';
      if (label) label.textContent = 'Branches';
    } else {
      if (icon) icon.textContent = '📜';
      if (label) label.textContent = 'Liste';
    }
  }

  getGroupTitleForPerson(p) {
    if (p.category === 'Famille') {
      if (p.branch) {
        return `Branche ${p.branch}`;
      } else if (p.familyName && p.familyName !== 'Ourahmoune') {
        return `Famille ${p.familyName}`;
      } else {
        return 'Famille Ourahmoune (Direct)';
      }
    } else if (p.category === 'Belle Famille') {
      return 'Belle Famille (Izri)';
    } else if (p.category === 'Voisins') {
      return p.familyName ? `Voisins (${p.familyName})` : 'Voisins';
    } else if (p.category === 'Amis') {
      return p.familyName ? `Amis (${p.familyName})` : 'Amis';
    }
    return p.category;
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
      
      let matchBranch = true;
      if (this.activeBranch !== 'all') {
        const groupTitle = this.getGroupTitleForPerson(p);
        matchBranch = (p.branch === this.activeBranch) || (groupTitle === this.activeBranch);
      }

      const matchStatus = this.activeFilter === 'all' || p.status === this.activeFilter;

      return matchSearch && matchCategory && matchBranch && matchStatus;
    });
  }

  getGroupKeys() {
    const filtered = this.getFilteredPeople();
    const keys = new Set();
    filtered.forEach(p => keys.add(this.getGroupTitleForPerson(p)));
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

    const branchEntries = Object.entries(branches).sort((a, b) => b[1] - a[1]);

    const chipsHtml = `
      <span class="text-[10px] font-semibold text-slate-500 shrink-0 self-center mr-0.5">Sous-groupes:</span>
      <button data-branch="all" class="branch-chip px-2 py-0.5 rounded-md text-[11px] font-bold transition shrink-0 ${
        this.activeBranch === 'all' ? 'bg-indigo-600 text-white' : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
      }">
        Tous (${people.filter(p => p.category === 'Famille').length})
      </button>
      ${branchEntries.map(([branch, count]) => `
        <button data-branch="${this.escapeAttr(branch)}" class="branch-chip px-2 py-0.5 rounded-md text-[11px] font-medium transition shrink-0 ${
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
    const totalEl = document.getElementById('count-total');
    if (totalEl) totalEl.textContent = counts.total;
    const invEl = document.getElementById('count-invited');
    if (invEl) invEl.textContent = counts.invited;
    const pendEl = document.getElementById('count-pending');
    if (pendEl) pendEl.textContent = counts.pending;
    const decEl = document.getElementById('count-declined');
    if (decEl) decEl.textContent = counts.declined;

    // Category pills badges
    const badgeAll = document.getElementById('cat-badge-all');
    if (badgeAll) badgeAll.textContent = counts.total;
    const badgeFam = document.getElementById('cat-badge-famille');
    if (badgeFam) badgeFam.textContent = categories['Famille'] || 0;
    const badgeBelle = document.getElementById('cat-badge-belle');
    if (badgeBelle) badgeBelle.textContent = categories['Belle Famille'] || 0;
    const badgeVoisins = document.getElementById('cat-badge-voisins');
    if (badgeVoisins) badgeVoisins.textContent = categories['Voisins'] || 0;
    const badgeAmis = document.getElementById('cat-badge-amis');
    if (badgeAmis) badgeAmis.textContent = categories['Amis'] || 0;

    this.updateUserHeaderUI();
    this.updateViewModeUI();
    this.renderBranchChips();
    this.renderList();
  }

  renderList() {
    const filtered = this.getFilteredPeople();
    const container = document.getElementById('people-list');
    const query = this.searchQuery.trim();

    if (!container) return;

    if (filtered.length === 0) {
      if (query) {
        container.innerHTML = `
          <div class="glass-panel rounded-2xl p-6 text-center border border-indigo-500/30 animate-fade-in my-4">
            <p class="text-sm text-slate-300">Aucun résultat pour <span class="text-white font-bold">"${this.escapeHtml(query)}"</span></p>
            <button id="btn-quick-add-from-search" class="mt-3 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow transition inline-flex items-center gap-1.5">
              <span>+ Ajouter "${this.escapeHtml(query)}"</span>
            </button>
          </div>
        `;
        document.getElementById('btn-quick-add-from-search')?.addEventListener('click', () => {
          document.getElementById('btn-open-add')?.click();
        });
      } else {
        container.innerHTML = `
          <div class="p-8 text-center text-slate-500">
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
        const groupTitle = this.getGroupTitleForPerson(p);
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
          <div class="glass-panel rounded-2xl border border-slate-800/80 overflow-hidden shadow-sm transition">
            <!-- Group Header (Collision-Proof) -->
            <div data-action="toggle-group" data-group-key="${this.escapeAttr(title)}" class="px-3 py-2.5 bg-slate-900/90 hover:bg-slate-900 border-b border-slate-800 flex items-center justify-between gap-2 cursor-pointer select-none">
              
              <!-- Left info: title and counts -->
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-1.5">
                  <span class="text-xs text-indigo-400">${isCollapsed ? '▶' : '▼'}</span>
                  <h3 class="font-bold text-white text-xs sm:text-sm truncate">
                    ${this.escapeHtml(title)}
                  </h3>
                  <span class="text-[11px] text-slate-400 font-normal shrink-0">(${members.length})</span>
                </div>
                
                <!-- Sub-counts pills -->
                <div class="flex items-center gap-2 text-[10px] mt-0.5 pl-3">
                  ${invitedCount > 0 ? `<span class="text-emerald-400 font-semibold">🟢 ${invitedCount}</span>` : ''}
                  ${pendingCount > 0 ? `<span class="text-amber-400 font-medium">🟡 ${pendingCount}</span>` : ''}
                  ${declinedCount > 0 ? `<span class="text-rose-400 font-medium">🔴 ${declinedCount}</span>` : ''}
                </div>
              </div>

              <!-- Right action button -->
              <div class="shrink-0 flex items-center gap-1">
                ${pendingCount > 0 ? `
                  <button data-action="batch-invite" data-ids="${memberIds}" class="px-2 py-1 rounded-lg text-[10px] sm:text-xs font-bold bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 transition flex items-center gap-1">
                    <span>✓ Tout inviter</span>
                  </button>
                ` : `
                  <span class="px-2 py-0.5 rounded text-[10px] text-emerald-400 bg-emerald-500/10 font-bold border border-emerald-500/20">
                    ✓ Tous invités
                  </span>
                `}
              </div>
            </div>

            <!-- Group Members list (if not collapsed) -->
            ${!isCollapsed ? `
              <div class="p-2 space-y-2 bg-slate-950/40">
                ${members.map(person => this.renderPersonCard(person)).join('')}
              </div>
            ` : ''}
          </div>
        `;
      }).join('');

    } else {
      // 2. Flat List View
      container.innerHTML = `
        <div class="space-y-2">
          ${filtered.map(person => this.renderPersonCard(person)).join('')}
        </div>
      `;
    }
  }

  renderPersonCard(person) {
    const isInvited = person.status === 'invited';
    const isDeclined = person.status === 'declined';
    const isPending = person.status === 'pending';

    let dateStr = '';
    if (person.invitedAt) {
      const d = new Date(person.invitedAt);
      dateStr = d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    }

    let borderClass = 'border-slate-800/80';
    let bgGlow = 'bg-slate-900/60';
    if (isInvited) {
      borderClass = 'border-emerald-500/30';
      bgGlow = 'bg-emerald-950/10';
    } else if (isDeclined) {
      borderClass = 'border-rose-500/20';
      bgGlow = 'bg-rose-950/10';
    }

    return `
      <div class="p-2.5 rounded-xl border ${borderClass} ${bgGlow} transition space-y-2">
        <!-- Top Row: Name + Badges + Delete -->
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-1.5 flex-wrap">
              <h4 class="font-bold text-xs sm:text-sm text-white truncate">
                ${this.escapeHtml(person.name)}
              </h4>

              <!-- Gender Badge -->
              ${person.gender ? `
                <span class="px-1.5 py-0.2 rounded text-[10px] font-semibold ${
                  person.gender === 'F' ? 'bg-pink-500/20 text-pink-300 border border-pink-500/30' : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                }">
                  ${person.gender === 'F' ? '👩 F' : '👨 H'}
                </span>
              ` : ''}

              <!-- Branch Badge -->
              ${person.branch ? `
                <span class="px-1.5 py-0.2 rounded text-[10px] font-medium bg-slate-800 text-slate-300 border border-slate-700">
                  ${this.escapeHtml(person.branch)}
                </span>
              ` : ''}
            </div>

            <!-- Details: Date or Comment -->
            <div class="mt-0.5 text-xs flex flex-wrap items-center gap-x-2">
              ${isInvited && dateStr ? `
                <span class="text-emerald-400 font-semibold text-[10px]">
                  ✓ Invité le ${dateStr}
                </span>
              ` : ''}

              ${isDeclined ? `
                <span class="text-rose-400 font-medium text-[10px]">✕ Non invité</span>
              ` : ''}

              ${person.comment ? `
                <span class="text-slate-400 italic text-[10px] bg-slate-800/80 px-1.5 py-0.5 rounded">
                  💬 ${this.escapeHtml(person.comment)}
                </span>
              ` : ''}
            </div>
          </div>

          <!-- Delete Icon -->
          <button data-action="delete" data-id="${person.id}" class="text-slate-500 hover:text-rose-400 p-1 rounded transition shrink-0" title="Supprimer">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
          </button>
        </div>

        <!-- 3-Pill Toggle -->
        <div class="grid grid-cols-3 gap-1 pt-1 border-t border-slate-800/70">
          <!-- 1. INVITÉ -->
          <button data-action="mark-invited" data-id="${person.id}" class="py-1 px-1 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1 ${
            isInvited
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'bg-slate-800/90 hover:bg-slate-700 text-slate-300 border border-slate-700/60'
          }">
            <svg class="w-3 h-3 ${isInvited ? 'text-white' : 'text-emerald-400'}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>
            <span>Invité</span>
          </button>

          <!-- 2. À DÉCIDER -->
          <button data-action="mark-pending" data-id="${person.id}" class="py-1 px-1 text-xs font-medium rounded-lg transition flex items-center justify-center gap-1 ${
            isPending
              ? 'bg-amber-600 text-white shadow-sm font-bold'
              : 'bg-slate-800/90 hover:bg-slate-700 text-slate-300 border border-slate-700/60'
          }">
            <span>À décider</span>
          </button>

          <!-- 3. ÉCARTER -->
          <button data-action="open-decline" data-id="${person.id}" class="py-1 px-1 text-xs font-medium rounded-lg transition flex items-center justify-center gap-1 ${
            isDeclined
              ? 'bg-rose-600 text-white shadow-sm font-bold'
              : 'bg-slate-800/90 hover:bg-slate-700 text-slate-300 border border-slate-700/60'
          }">
            <svg class="w-3 h-3 ${isDeclined ? 'text-white' : 'text-rose-400'}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
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
      container.className = 'fixed top-3 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 max-w-xs w-full pointer-events-none px-3';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    const colors = {
      success: 'bg-emerald-600',
      error: 'bg-rose-600',
      info: 'bg-indigo-600',
      warning: 'bg-amber-600'
    };

    toast.className = `${colors[type] || colors.info} text-white px-3 py-2 rounded-xl shadow-xl text-xs font-semibold text-center animate-fade-in pointer-events-auto border border-white/10`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 2500);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.inviApp = new InvitationApp();
});
