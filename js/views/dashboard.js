/**
 * Dashboard View
 */

export function renderDashboard(store, navigate) {
  const { stats, settings, guests } = store.getSnapshot();

  const container = document.createElement('div');
  container.className = 'space-y-6 animate-fade-in';

  container.innerHTML = `
    <!-- Header Banner -->
    <div class="glass-panel rounded-2xl p-6 relative overflow-hidden bg-gradient-to-r from-indigo-900/60 to-purple-900/40 border border-indigo-500/20">
      <div class="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
            <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            Suivi en temps réel
          </span>
          <h1 class="text-2xl md:text-3xl font-extrabold text-white mt-2">${settings.eventName}</h1>
          <p class="text-slate-300 text-sm mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
            <span>📅 ${settings.eventDate || 'Date non définie'} ${settings.eventTime ? 'à ' + settings.eventTime : ''}</span>
            <span>📍 ${settings.venue || 'Lieu non spécifié'}</span>
          </p>
        </div>
        <div class="flex items-center gap-2">
          <button id="btn-quick-add" class="bg-indigo-600 hover:bg-indigo-500 text-white font-medium px-4 py-2.5 rounded-xl shadow-lg shadow-indigo-600/30 text-sm flex items-center gap-2 transition">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
            Nouvel invité
          </button>
          <button id="btn-dispatch-wa" class="bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-4 py-2.5 rounded-xl shadow-lg shadow-emerald-600/30 text-sm flex items-center gap-2 transition">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
            Envoyer (WhatsApp)
          </button>
        </div>
      </div>
    </div>

    <!-- Quick Stats Grid -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <!-- Total Invitations -->
      <div class="glass-card rounded-2xl p-5 border border-slate-700/50">
        <div class="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider">
          <span>Total Invités</span>
          <span class="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
          </span>
        </div>
        <div class="mt-3 flex items-baseline gap-2">
          <span class="text-3xl font-bold text-white">${stats.totalSeats}</span>
          <span class="text-xs text-slate-400">personnes (${stats.totalInvitations} invitations)</span>
        </div>
      </div>

      <!-- Sent -->
      <div class="glass-card rounded-2xl p-5 border border-slate-700/50">
        <div class="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider">
          <span>Envoyées</span>
          <span class="p-2 rounded-lg bg-blue-500/10 text-blue-400">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/></svg>
          </span>
        </div>
        <div class="mt-3 flex items-baseline gap-2">
          <span class="text-3xl font-bold text-blue-400">${stats.sentCount}</span>
          <span class="text-xs text-slate-400">/ ${stats.totalInvitations} envoyées</span>
        </div>
      </div>

      <!-- Confirmed -->
      <div class="glass-card rounded-2xl p-5 border border-slate-700/50">
        <div class="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider">
          <span>Confirmés</span>
          <span class="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          </span>
        </div>
        <div class="mt-3 flex items-baseline gap-2">
          <span class="text-3xl font-bold text-emerald-400">${stats.confirmedSeats}</span>
          <span class="text-xs text-slate-400">personnes (${stats.confirmationRate}%)</span>
        </div>
      </div>

      <!-- Pending / Waiting -->
      <div class="glass-card rounded-2xl p-5 border border-slate-700/50">
        <div class="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider">
          <span>En attente</span>
          <span class="p-2 rounded-lg bg-amber-500/10 text-amber-400">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          </span>
        </div>
        <div class="mt-3 flex items-baseline gap-2">
          <span class="text-3xl font-bold text-amber-400">${stats.pendingSeats}</span>
          <span class="text-xs text-slate-400">personnes (${stats.counts.draft + stats.counts.sent + stats.counts.delivered} inv.)</span>
        </div>
      </div>
    </div>

    <!-- RSVP & Pipeline Progress -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Progress Bar & Breakdown -->
      <div class="lg:col-span-2 glass-panel rounded-2xl p-6 border border-slate-700/50">
        <h2 class="text-lg font-bold text-white mb-4 flex items-center justify-between">
          <span>Statut des Réponses (RSVP)</span>
          <span class="text-xs font-normal text-slate-400">Date limite : ${settings.rsvpDeadline || 'Non fixée'}</span>
        </h2>

        <!-- Visual Multi-segment Bar -->
        <div class="w-full h-4 bg-slate-800 rounded-full overflow-hidden flex mb-4">
          <div style="width: ${(stats.counts.confirmed / (stats.totalInvitations || 1)) * 100}%" class="bg-emerald-500 transition-all duration-500" title="Confirmés"></div>
          <div style="width: ${(stats.counts.declined / (stats.totalInvitations || 1)) * 100}%" class="bg-rose-500 transition-all duration-500" title="Déclinés"></div>
          <div style="width: ${(stats.counts.delivered / (stats.totalInvitations || 1)) * 100}%" class="bg-purple-500 transition-all duration-500" title="Reçus"></div>
          <div style="width: ${(stats.counts.sent / (stats.totalInvitations || 1)) * 100}%" class="bg-blue-500 transition-all duration-500" title="Envoyés"></div>
          <div style="width: ${(stats.counts.draft / (stats.totalInvitations || 1)) * 100}%" class="bg-slate-600 transition-all duration-500" title="Brouillons"></div>
        </div>

        <!-- Legend Pills -->
        <div class="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
          <div class="flex items-center gap-2 p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <span class="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
            <div>
              <p class="font-bold">${stats.counts.confirmed} (${stats.confirmedSeats} pers.)</p>
              <p class="text-[10px] text-slate-400">Confirmés</p>
            </div>
          </div>
          <div class="flex items-center gap-2 p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400">
            <span class="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
            <div>
              <p class="font-bold">${stats.counts.declined} (${stats.declinedSeats} pers.)</p>
              <p class="text-[10px] text-slate-400">Déclinés</p>
            </div>
          </div>
          <div class="flex items-center gap-2 p-2 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400">
            <span class="w-2.5 h-2.5 rounded-full bg-purple-500"></span>
            <div>
              <p class="font-bold">${stats.counts.delivered}</p>
              <p class="text-[10px] text-slate-400">Livrés / Reçus</p>
            </div>
          </div>
          <div class="flex items-center gap-2 p-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400">
            <span class="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
            <div>
              <p class="font-bold">${stats.counts.sent}</p>
              <p class="text-[10px] text-slate-400">Envoyés</p>
            </div>
          </div>
          <div class="flex items-center gap-2 p-2 rounded-lg bg-slate-700/40 border border-slate-600/30 text-slate-300">
            <span class="w-2.5 h-2.5 rounded-full bg-slate-500"></span>
            <div>
              <p class="font-bold">${stats.counts.draft}</p>
              <p class="text-[10px] text-slate-400">Non envoyés</p>
            </div>
          </div>
        </div>

        <!-- Venue Check-in teaser -->
        <div class="mt-6 pt-4 border-t border-slate-700/60 flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="p-2.5 rounded-xl bg-purple-500/10 text-purple-400">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>
            </div>
            <div>
              <p class="text-sm font-semibold text-white">Émargement / Présence Jour-J</p>
              <p class="text-xs text-slate-400">${stats.checkedInSeats} personnes déjà arrivées</p>
            </div>
          </div>
          <button id="btn-go-checkin" class="text-xs font-semibold text-purple-400 hover:text-purple-300 underline">
            Ouvrir l'émargement &rarr;
          </button>
        </div>
      </div>

      <!-- Categories & Groups Distribution -->
      <div class="glass-panel rounded-2xl p-6 border border-slate-700/50 flex flex-col justify-between">
        <div>
          <h2 class="text-lg font-bold text-white mb-4">Répartition par Groupe</h2>
          <div class="space-y-3">
            ${Object.entries(stats.categories).map(([category, count]) => {
              const pct = stats.totalSeats > 0 ? Math.round((count / stats.totalSeats) * 100) : 0;
              return `
                <div>
                  <div class="flex justify-between text-xs mb-1">
                    <span class="text-slate-300 font-medium">${category}</span>
                    <span class="text-slate-400">${count} pers. (${pct}%)</span>
                  </div>
                  <div class="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div style="width: ${pct}%" class="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full"></div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <div class="mt-6 pt-4 border-t border-slate-700/60">
          <button id="btn-see-all-guests" class="w-full text-center py-2 text-xs font-semibold text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 rounded-xl hover:bg-indigo-500/20 transition">
            Voir et gérer toute la liste des invités &rarr;
          </button>
        </div>
      </div>
    </div>
  `;

  // Attach event listeners
  setTimeout(() => {
    container.querySelector('#btn-quick-add')?.addEventListener('click', () => {
      navigate('guests', { openAddModal: true });
    });

    container.querySelector('#btn-dispatch-wa')?.addEventListener('click', () => {
      navigate('invitations');
    });

    container.querySelector('#btn-go-checkin')?.addEventListener('click', () => {
      navigate('checkin');
    });

    container.querySelector('#btn-see-all-guests')?.addEventListener('click', () => {
      navigate('guests');
    });
  }, 0);

  return container;
}
