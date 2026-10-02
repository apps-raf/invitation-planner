/**
 * InviTrack - Ultra-Light Mobile-First Invitation Tracker
 */

import { store } from './store.js';

class InvitationApp {
  constructor() {
    this.searchQuery = '';
    this.activeFilter = 'all'; // 'all', 'invited', 'pending', 'declined'
    this.activeCategory = 'all';
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

    // Filter pills
    document.querySelectorAll('.filter-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        this.activeFilter = btn.getAttribute('data-filter');
        document.querySelectorAll('.filter-pill').forEach(b => {
          b.classList.remove('bg-indigo-600', 'text-white', 'shadow-md');
          b.classList.add('bg-slate-800/80', 'text-slate-400');
        });
        btn.classList.remove('bg-slate-800/80', 'text-slate-400');
        btn.classList.add('bg-indigo-600', 'text-white', 'shadow-md');
        this.renderList();
      });
    });

    // Category filter dropdown
    document.getElementById('category-filter')?.addEventListener('change', (e) => {
      this.activeCategory = e.target.value;
      this.renderList();
    });

    // Quick Add Person Modal
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
      const category = document.getElementById('add-category-input').value || 'Général';
      const status = document.getElementById('add-status-input').value || 'pending';
      const comment = document.getElementById('add-comment-input').value || '';

      store.addPerson(name, category, status, comment);
      addModal.classList.add('hidden');
      addForm.reset();
      this.searchQuery = '';
      if (searchInput) searchInput.value = '';
      if (clearSearchBtn) clearSearchBtn.style.display = 'none';
      this.showToast(`"${name}" ajouté à la liste !`, 'success');
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

    // Preset quick reason tags in decline modal
    document.querySelectorAll('.preset-reason').forEach(tag => {
      tag.addEventListener('click', () => {
        const input = document.getElementById('decline-comment-input');
        input.value = tag.getAttribute('data-reason');
      });
    });

    // Google Sheets Modal
    const gsheetModal = document.getElementById('gsheet-modal');
    document.getElementById('btn-open-gsheet')?.addEventListener('click', () => {
      const { config } = store.getSnapshot();
      document.getElementById('gsheet-url-input').value = config.endpointUrl || config.sheetCsvUrl || '';
      gsheetModal.classList.remove('hidden');
    });

    document.getElementById('btn-close-gsheet')?.addEventListener('click', () => {
      gsheetModal.classList.add('hidden');
    });

    document.getElementById('btn-save-gsheet')?.addEventListener('click', async () => {
      const url = document.getElementById('gsheet-url-input').value.trim();
      if (!url) {
        this.showToast('Veuillez entrer une URL', 'warning');
        return;
      }

      if (url.includes('script.google.com')) {
        store.saveConfig({ endpointUrl: url });
      } else {
        store.saveConfig({ sheetCsvUrl: url });
      }

      this.showToast('Connexion Google Sheets configurée ! Synchronisation...', 'info');
      const res = await store.syncFromGoogleSheet();
      if (res.success) {
        this.showToast(`Synchronisation réussie (${res.count} personnes) !`, 'success');
        gsheetModal.classList.add('hidden');
      } else {
        this.showToast(`Erreur de synchronisation : ${res.message}`, 'error');
      }
    });

    // Manual sync button
    document.getElementById('btn-manual-sync')?.addEventListener('click', async () => {
      const { config } = store.getSnapshot();
      if (!config.endpointUrl && !config.sheetCsvUrl) {
        document.getElementById('btn-open-gsheet').click();
        return;
      }
      this.showToast('Synchronisation avec Google Sheets...', 'info');
      const res = await store.syncFromGoogleSheet();
      if (res.success) {
        this.showToast(`Synchronisé (${res.count} personnes) !`, 'success');
      } else {
        this.showToast(`Erreur : ${res.message}`, 'error');
      }
    });

    // Copy Apps Script button
    document.getElementById('btn-copy-script')?.addEventListener('click', () => {
      const scriptCode = `// Code Google Apps Script pour synchroniser votre Google Sheet avec InviTrack
function doGet(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  setupHeadersIfNeeded(sheet);
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return ContentService.createTextOutput("[]").setMimeType(ContentService.MimeType.JSON);
  var list = [];
  for (var i = 1; i < data.length; i++) {
    if (!data[i][0]) continue;
    list.push({
      id: "gs_" + i,
      name: String(data[i][0] || ""),
      category: String(data[i][1] || "Général"),
      status: String(data[i][2] || "pending").toLowerCase(),
      invitedAt: data[i][3] ? Utilities.formatDate(new Date(data[i][3]), Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss'Z'") : null,
      comment: String(data[i][4] || "")
    });
  }
  return ContentService.createTextOutput(JSON.stringify(list)).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var payload = JSON.parse(e.postData.contents);
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  setupHeadersIfNeeded(sheet);
  if (payload.action === "upsertGuest" && payload.guest) {
    var g = payload.guest;
    var data = sheet.getDataRange().getValues();
    var row = -1;
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]).toLowerCase().trim() === String(g.name).toLowerCase().trim()) { row = i + 1; break; }
    }
    var d = g.invitedAt ? new Date(g.invitedAt).toLocaleString("fr-FR") : "";
    if (row > 0) {
      sheet.getRange(row, 2).setValue(g.category || "Général");
      sheet.getRange(row, 3).setValue(g.status || "pending");
      sheet.getRange(row, 4).setValue(g.status === "invited" ? d : "");
      sheet.getRange(row, 5).setValue(g.comment || "");
    } else {
      sheet.appendRow([g.name, g.category || "Général", g.status || "pending", g.status === "invited" ? d : "", g.comment || ""]);
    }
    return ContentService.createTextOutput(JSON.stringify({ success: true })).setMimeType(ContentService.MimeType.JSON);
  }
}

function setupHeadersIfNeeded(sheet) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(["Nom", "Groupe", "Statut", "Date Invitation", "Commentaire"]);
    sheet.getRange(1, 1, 1, 5).setFontWeight("bold").setBackground("#EEF2FF");
  }
}`;
      navigator.clipboard.writeText(scriptCode).then(() => {
        this.showToast('Code Google Apps Script copié !', 'success');
      });
    });

    // Delegated status action clicks on list items
    document.getElementById('people-list')?.addEventListener('click', (e) => {
      // 1-Click: Mark Invited
      const btnInvite = e.target.closest('[data-action="mark-invited"]');
      if (btnInvite) {
        const id = btnInvite.getAttribute('data-id');
        store.markInvited(id);
        if ('vibrate' in navigator) navigator.vibrate(30);
        this.showToast('Coché : Invité !', 'success');
        return;
      }

      // Mark Declined (open decline note modal)
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

      // Mark Pending (To decide)
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

  getFilteredPeople() {
    const { people } = store.getSnapshot();
    const query = this.searchQuery.toLowerCase().trim();

    return people.filter(p => {
      // Search match
      const matchSearch = !query ||
        p.name.toLowerCase().includes(query) ||
        (p.category && p.category.toLowerCase().includes(query)) ||
        (p.comment && p.comment.toLowerCase().includes(query));

      // Status filter
      const matchStatus = this.activeFilter === 'all' || p.status === this.activeFilter;

      // Category filter
      const matchCategory = this.activeCategory === 'all' || p.category === this.activeCategory;

      return matchSearch && matchStatus && matchCategory;
    });
  }

  render() {
    const { counts, config, isSyncing, people } = store.getSnapshot();

    // Top counts pills
    document.getElementById('count-total').textContent = counts.total;
    document.getElementById('count-invited').textContent = counts.invited;
    document.getElementById('count-pending').textContent = counts.pending;
    document.getElementById('count-declined').textContent = counts.declined;

    // Filter pill badges
    document.getElementById('badge-filter-all').textContent = counts.total;
    document.getElementById('badge-filter-invited').textContent = counts.invited;
    document.getElementById('badge-filter-pending').textContent = counts.pending;
    document.getElementById('badge-filter-declined').textContent = counts.declined;

    // Sync button status
    const syncStatusDot = document.getElementById('sync-status-dot');
    const syncLabel = document.getElementById('sync-label');
    if (config.endpointUrl || config.sheetCsvUrl) {
      syncStatusDot.className = 'w-2 h-2 rounded-full bg-emerald-400 animate-pulse';
      syncLabel.textContent = isSyncing ? 'Synchronisation...' : 'Google Sheet Lié';
    } else {
      syncStatusDot.className = 'w-2 h-2 rounded-full bg-amber-400';
      syncLabel.textContent = 'Lier Google Sheet';
    }

    // Populate category dropdown
    const categories = Array.from(new Set(people.map(p => p.category || 'Général'))).filter(Boolean);
    const catSelect = document.getElementById('category-filter');
    if (catSelect) {
      const currentVal = this.activeCategory;
      catSelect.innerHTML = `<option value="all">Tous les groupes</option>` +
        categories.map(c => `<option value="${this.escapeHtml(c)}" ${c === currentVal ? 'selected' : ''}>${this.escapeHtml(c)}</option>`).join('');
    }

    this.renderList();
  }

  renderList() {
    const filtered = this.getFilteredPeople();
    const container = document.getElementById('people-list');
    const query = this.searchQuery.trim();

    if (filtered.length === 0) {
      if (query) {
        // Spotlight instant creation prompt!
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
            <p class="text-sm font-medium text-slate-400">Aucune personne dans cette catégorie</p>
            <p class="text-xs text-slate-600 mt-1">Utilisez la recherche ci-dessus pour trouver ou ajouter quelqu'un.</p>
          </div>
        `;
      }
      return;
    }

    container.innerHTML = filtered.map(person => {
      const isInvited = person.status === 'invited';
      const isDeclined = person.status === 'declined';
      const isPending = !isInvited && !isDeclined;

      const dateStr = person.invitedAt ? new Date(person.invitedAt).toLocaleDateString('fr-FR', {
        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
      }) : null;

      return `
        <div class="glass-card rounded-2xl p-4 border transition ${
          isInvited ? 'border-emerald-500/30 bg-emerald-950/10' :
          isDeclined ? 'border-rose-500/20 bg-rose-950/10 opacity-75' :
          'border-slate-800 bg-slate-900/60'
        } flex flex-col gap-3">

          <!-- Top Row: Name, Category, & Status Info -->
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <h3 class="font-bold text-white text-base truncate">${this.escapeHtml(person.name)}</h3>
                <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                  ${this.escapeHtml(person.category || 'Général')}
                </span>
              </div>

              <!-- Timestamp & Comment badge -->
              <div class="mt-1 text-xs flex flex-wrap items-center gap-x-3 gap-y-1">
                ${isInvited && dateStr ? `
                  <span class="text-emerald-400 font-medium flex items-center gap-1">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                    Invité le ${dateStr}
                  </span>
                ` : ''}

                ${isDeclined ? `
                  <span class="text-rose-400 font-medium">❌ Non invité</span>
                ` : ''}

                ${isPending ? `
                  <span class="text-amber-400 font-medium">⏳ À décider</span>
                ` : ''}

                ${person.comment ? `
                  <span class="text-slate-400 italic text-[11px] bg-slate-800/80 px-2 py-0.5 rounded">
                    💬 ${this.escapeHtml(person.comment)}
                  </span>
                ` : ''}
              </div>
            </div>

            <!-- Delete action icon -->
            <button data-action="delete" data-id="${person.id}" class="text-slate-500 hover:text-rose-400 p-1 rounded-lg transition" title="Supprimer">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            </button>
          </div>

          <!-- Bottom Action Buttons: Fast 3-Pill Toggle -->
          <div class="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800/80">
            <!-- 1. INVITÉ (Check) -->
            <button data-action="mark-invited" data-id="${person.id}" class="py-2 px-1 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 ${
              isInvited
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/60'
            }">
              <svg class="w-4 h-4 ${isInvited ? 'text-white' : 'text-emerald-400'}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>
              <span>Invité</span>
            </button>

            <!-- 2. À DÉCIDER -->
            <button data-action="mark-pending" data-id="${person.id}" class="py-2 px-1 text-xs font-medium rounded-xl transition flex items-center justify-center gap-1 ${
              isPending
                ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/30 font-bold'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/60'
            }">
              <span>À décider</span>
            </button>

            <!-- 3. NE PAS INVITER -->
            <button data-action="open-decline" data-id="${person.id}" class="py-2 px-1 text-xs font-medium rounded-xl transition flex items-center justify-center gap-1.5 ${
              isDeclined
                ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/30 font-bold'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/60'
            }">
              <svg class="w-3.5 h-3.5 ${isDeclined ? 'text-white' : 'text-rose-400'}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
              <span>Écarter</span>
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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
    }, 2500);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.inviApp = new InvitationApp();
});
