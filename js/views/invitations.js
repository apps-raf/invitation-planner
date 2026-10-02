/**
 * Invitation Tracking & Dispatch View
 */

import { Utils } from '../utils.js';

export function renderInvitations(store, navigate) {
  const { guests, settings } = store.getSnapshot();

  let activeTab = 'draft'; // 'all', 'draft', 'sent', 'confirmed', 'declined'

  const container = document.createElement('div');
  container.className = 'space-y-6 animate-fade-in';

  function getFilteredGuests() {
    if (activeTab === 'all') return guests;
    if (activeTab === 'draft') return guests.filter(g => !g.status || g.status === 'draft');
    if (activeTab === 'sent') return guests.filter(g => g.status === 'sent' || g.status === 'delivered');
    if (activeTab === 'confirmed') return guests.filter(g => g.status === 'confirmed');
    if (activeTab === 'declined') return guests.filter(g => g.status === 'declined');
    return guests;
  }

  function renderList() {
    const listContainer = container.querySelector('#invitation-cards-list');
    const filtered = getFilteredGuests();

    // Update count badges on tabs
    const counts = {
      all: guests.length,
      draft: guests.filter(g => !g.status || g.status === 'draft').length,
      sent: guests.filter(g => g.status === 'sent' || g.status === 'delivered').length,
      confirmed: guests.filter(g => g.status === 'confirmed').length,
      declined: guests.filter(g => g.status === 'declined').length
    };

    container.querySelectorAll('[data-tab-count]').forEach(el => {
      const tab = el.getAttribute('data-tab-count');
      if (counts[tab] !== undefined) {
        el.textContent = counts[tab];
      }
    });

    if (filtered.length === 0) {
      listContainer.innerHTML = `
        <div class="glass-panel rounded-2xl p-12 text-center text-slate-400 border border-slate-700/60">
          <svg class="w-12 h-12 mx-auto mb-3 text-slate-500 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
          <p class="text-base font-semibold text-slate-300">Aucune invitation dans cette catégorie</p>
          <p class="text-xs text-slate-500 mt-1">Sélectionnez un autre onglet pour voir vos invités.</p>
        </div>
      `;
      return;
    }

    listContainer.innerHTML = filtered.map(guest => {
      const hasPhone = Boolean(guest.phone);
      const isSent = guest.status === 'sent' || guest.status === 'delivered' || guest.status === 'confirmed';
      const personalizedMsg = Utils.interpolateTemplate(settings.whatsappTemplate, guest, settings);
      const waLink = Utils.createWhatsAppLink(guest.phone, settings.whatsappTemplate, guest, settings);

      return `
        <div class="glass-card rounded-2xl p-5 border border-slate-700/60 space-y-4">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div class="flex items-start gap-3">
              <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-white shadow-lg text-sm shrink-0">
                ${escapeHtml(guest.name.charAt(0))}
              </div>
              <div>
                <h3 class="font-bold text-white text-base flex items-center gap-2">
                  <span>${escapeHtml(guest.name)}</span>
                  <span class="px-2 py-0.5 rounded text-[11px] font-normal bg-indigo-500/20 text-indigo-300">
                    ${guest.seats || 1} place(s)
                  </span>
                </h3>
                <div class="flex items-center gap-3 text-xs text-slate-400 mt-1">
                  <span>👥 ${escapeHtml(guest.category || 'Général')}</span>
                  ${guest.phone ? `<span class="text-emerald-400">📱 ${escapeHtml(guest.phone)}</span>` : '<span class="text-amber-400/80">⚠️ Pas de numéro</span>'}
                  ${guest.table ? `<span>🪑 ${escapeHtml(guest.table)}</span>` : ''}
                </div>
              </div>
            </div>

            <!-- Current Status Badge -->
            <div class="flex items-center gap-2">
              <span class="text-xs text-slate-400">Statut :</span>
              <select data-action="change-status" data-id="${guest.id}" class="bg-slate-800 text-xs font-medium rounded-lg px-2.5 py-1.5 border border-slate-700 text-slate-200">
                <option value="draft" ${guest.status === 'draft' ? 'selected' : ''}>⏳ Brouillon (À envoyer)</option>
                <option value="sent" ${guest.status === 'sent' ? 'selected' : ''}>📤 Envoyé</option>
                <option value="delivered" ${guest.status === 'delivered' ? 'selected' : ''}>📬 Reçu / Lu</option>
                <option value="confirmed" ${guest.status === 'confirmed' ? 'selected' : ''}>✅ Confirmé (Présent)</option>
                <option value="declined" ${guest.status === 'declined' ? 'selected' : ''}>❌ Décliné (Absent)</option>
              </select>
            </div>
          </div>

          <!-- Message Preview Accordion -->
          <div class="bg-slate-900/80 rounded-xl p-3 border border-slate-800 text-xs text-slate-300 relative">
            <p class="font-semibold text-slate-400 text-[11px] uppercase tracking-wider mb-1 flex items-center justify-between">
              <span>Aperçu du message personnalisé</span>
              <button data-action="copy-msg" data-msg="${escapeAttr(personalizedMsg)}" class="text-indigo-400 hover:text-indigo-300 normal-case flex items-center gap-1">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
                Copier le texte
              </button>
            </p>
            <div class="whitespace-pre-wrap font-sans text-slate-300 line-clamp-3 select-all">${escapeHtml(personalizedMsg)}</div>
          </div>

          <!-- Action buttons for dispatch -->
          <div class="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800">
            <div class="text-xs text-slate-500">
              ${guest.sentAt ? `<span>Envoyé le ${new Date(guest.sentAt).toLocaleDateString('fr-FR')}</span>` : '<span>Non envoyé</span>'}
              ${guest.confirmedAt ? ` • <span class="text-emerald-400">Réponse le ${new Date(guest.confirmedAt).toLocaleDateString('fr-FR')}</span>` : ''}
            </div>

            <div class="flex items-center gap-2">
              ${hasPhone ? `
                <a href="${waLink}" target="_blank" data-action="track-whatsapp" data-id="${guest.id}" class="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 shadow-md shadow-emerald-600/30 transition">
                  <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/></svg>
                  Envoyer via WhatsApp
                </a>
              ` : `
                <button disabled class="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium text-slate-500 bg-slate-800 cursor-not-allowed">
                  Numéro manquant
                </button>
              `}

              ${!isSent ? `
                <button data-action="mark-sent" data-id="${guest.id}" class="px-3 py-2 rounded-xl text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition">
                  Marquer comme envoyé
                </button>
              ` : ''}
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function escapeAttr(str) {
    if (!str) return '';
    return String(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  container.innerHTML = `
    <!-- Top Bar -->
    <div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold text-white">Centre d'Envoi & Suivi des Invitations</h1>
        <p class="text-xs text-slate-400 mt-0.5">Envoyez les invitations personnalisées par WhatsApp ou SMS et suivez l'avancement.</p>
      </div>

      <!-- Quick Template link -->
      <button id="btn-edit-template" class="px-3 py-2 text-xs font-semibold text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 rounded-xl border border-indigo-500/20 transition flex items-center gap-1.5">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
        Personnaliser le texte du message
      </button>
    </div>

    <!-- Filter Tabs -->
    <div class="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-800 scrollbar-none">
      <button data-tab="draft" class="tab-btn px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 bg-indigo-600 text-white">
        <span>À envoyer (Brouillons)</span>
        <span data-tab-count="draft" class="px-1.5 py-0.5 rounded-full text-[10px] bg-indigo-800">0</span>
      </button>
      <button data-tab="sent" class="tab-btn px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition flex items-center gap-2">
        <span>Envoyés</span>
        <span data-tab-count="sent" class="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-700">0</span>
      </button>
      <button data-tab="confirmed" class="tab-btn px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition flex items-center gap-2">
        <span>Confirmés</span>
        <span data-tab-count="confirmed" class="px-1.5 py-0.5 rounded-full text-[10px] bg-emerald-900/60 text-emerald-300">0</span>
      </button>
      <button data-tab="declined" class="tab-btn px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition flex items-center gap-2">
        <span>Déclinés</span>
        <span data-tab-count="declined" class="px-1.5 py-0.5 rounded-full text-[10px] bg-rose-900/60 text-rose-300">0</span>
      </button>
      <button data-tab="all" class="tab-btn px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition flex items-center gap-2">
        <span>Tous</span>
        <span data-tab-count="all" class="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-700">0</span>
      </button>
    </div>

    <!-- Cards List Container -->
    <div id="invitation-cards-list" class="space-y-4"></div>
  `;

  // Attach event listeners
  setTimeout(() => {
    // Tab switching
    container.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        container.querySelectorAll('.tab-btn').forEach(b => {
          b.className = 'tab-btn px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition flex items-center gap-2';
        });
        btn.className = 'tab-btn px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 bg-indigo-600 text-white';
        activeTab = btn.getAttribute('data-tab');
        renderList();
      });
    });

    container.querySelector('#btn-edit-template')?.addEventListener('click', () => {
      navigate('settings');
    });

    // Delegated actions
    container.addEventListener('click', (e) => {
      // Copy Message text
      const copyBtn = e.target.closest('[data-action="copy-msg"]');
      if (copyBtn) {
        const text = copyBtn.getAttribute('data-msg');
        navigator.clipboard.writeText(text).then(() => {
          Utils.showToast('Message copié dans le presse-papier !', 'success');
        });
        return;
      }

      // Track WhatsApp click and auto-mark as sent
      const waBtn = e.target.closest('[data-action="track-whatsapp"]');
      if (waBtn) {
        const id = waBtn.getAttribute('data-id');
        const guest = store.guests.find(g => g.id === id);
        if (guest && guest.status === 'draft') {
          store.updateStatus(id, 'sent');
          Utils.showToast(`Invitation marquée comme envoyée pour ${guest.name}`, 'info');
          setTimeout(() => renderList(), 500);
        }
        return;
      }

      // Mark Sent button
      const markBtn = e.target.closest('[data-action="mark-sent"]');
      if (markBtn) {
        const id = markBtn.getAttribute('data-id');
        store.updateStatus(id, 'sent');
        Utils.showToast('Statut mis à jour sur : Envoyé', 'success');
        renderList();
        return;
      }
    });

    container.addEventListener('change', (e) => {
      if (e.target.matches('[data-action="change-status"]')) {
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
