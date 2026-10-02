/**
 * Utility functions for Invitation Planner
 */

export const Utils = {
  // Generate a random unique ID
  uid() {
    return 'g_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
  },

  // Format phone number to international WhatsApp standard
  formatPhoneForWhatsApp(phone) {
    if (!phone) return '';
    // Strip non-digits except leading +
    let cleaned = phone.replace(/[^0-9+]/g, '');
    if (cleaned.startsWith('+')) {
      cleaned = cleaned.substring(1);
    }
    // Remove leading zeros if present (common in national numbers e.g. 06 -> 336)
    return cleaned;
  },

  // Generate personalized WhatsApp Link
  createWhatsAppLink(phone, template, guest, eventSettings) {
    const formattedPhone = this.formatPhoneForWhatsApp(phone);
    if (!formattedPhone) return null;

    const message = this.interpolateTemplate(template, guest, eventSettings);
    return `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;
  },

  // Generate SMS link
  createSmsLink(phone, template, guest, eventSettings) {
    const formattedPhone = this.formatPhoneForWhatsApp(phone);
    if (!formattedPhone) return null;
    const message = this.interpolateTemplate(template, guest, eventSettings);
    return `sms:${formattedPhone}?body=${encodeURIComponent(message)}`;
  },

  // Interpolate placeholders: {name}, {seats}, {category}, {event_name}, {date}, {time}, {venue}, {rsvp_link}
  interpolateTemplate(template, guest, eventSettings) {
    if (!template) return '';
    return template
      .replace(/{name}/g, guest.name || 'Cher invité')
      .replace(/{seats}/g, guest.seats || 1)
      .replace(/{category}/g, guest.category || 'Général')
      .replace(/{table}/g, guest.table || 'Non assignée')
      .replace(/{event_name}/g, eventSettings.eventName || 'Notre Événement')
      .replace(/{date}/g, eventSettings.eventDate || '')
      .replace(/{time}/g, eventSettings.eventTime || '')
      .replace(/{venue}/g, eventSettings.venue || '')
      .replace(/{rsvp_deadline}/g, eventSettings.rsvpDeadline || '')
      .replace(/{invitation_url}/g, eventSettings.invitationUrl || '')
      .replace(/{guest_id}/g, guest.id);
  },

  // Convert guests array to CSV text
  exportGuestsToCSV(guests) {
    const headers = ['Nom', 'Téléphone', 'Email', 'Groupe', 'Statut', 'Places', 'Table', 'Régime/Notes', 'Présence'];
    const rows = guests.map(g => [
      `"${(g.name || '').replace(/"/g, '""')}"`,
      `"${(g.phone || '').replace(/"/g, '""')}"`,
      `"${(g.email || '').replace(/"/g, '""')}"`,
      `"${(g.category || '').replace(/"/g, '""')}"`,
      `"${(g.status || 'draft').replace(/"/g, '""')}"`,
      g.seats || 1,
      `"${(g.table || '').replace(/"/g, '""')}"`,
      `"${(g.notes || '').replace(/"/g, '""')}"`,
      g.checkedIn ? 'Oui' : 'Non'
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `liste_invites_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  },

  // Parse CSV text into guests array
  parseCSVToGuests(csvText) {
    const lines = csvText.split(/\r?\n/).filter(line => line.trim().length > 0);
    if (lines.length < 2) return [];

    // Header index mapping
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, '').toLowerCase());
    const nameIdx = headers.findIndex(h => h.includes('nom') || h.includes('name'));
    const phoneIdx = headers.findIndex(h => h.includes('téléphone') || h.includes('tel') || h.includes('phone'));
    const emailIdx = headers.findIndex(h => h.includes('email') || h.includes('courriel') || h.includes('mail'));
    const categoryIdx = headers.findIndex(h => h.includes('groupe') || h.includes('category') || h.includes('famille'));
    const seatsIdx = headers.findIndex(h => h.includes('place') || h.includes('seats') || h.includes('nombre'));
    const tableIdx = headers.findIndex(h => h.includes('table'));
    const notesIdx = headers.findIndex(h => h.includes('note') || h.includes('régime') || h.includes('diet'));

    const guests = [];
    for (let i = 1; i < lines.length; i++) {
      // Split preserving quotes
      const row = lines[i].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || lines[i].split(',');
      const cleanVal = (val) => val ? val.trim().replace(/^"|"$/g, '').trim() : '';

      const name = nameIdx !== -1 ? cleanVal(row[nameIdx]) : cleanVal(row[0]);
      if (!name) continue;

      guests.push({
        id: this.uid(),
        name,
        phone: phoneIdx !== -1 ? cleanVal(row[phoneIdx]) : '',
        email: emailIdx !== -1 ? cleanVal(row[emailIdx]) : '',
        category: categoryIdx !== -1 ? cleanVal(row[categoryIdx]) || 'Général' : 'Général',
        seats: seatsIdx !== -1 ? parseInt(cleanVal(row[seatsIdx])) || 1 : 1,
        table: tableIdx !== -1 ? cleanVal(row[tableIdx]) : '',
        notes: notesIdx !== -1 ? cleanVal(row[notesIdx]) : '',
        status: 'draft',
        sentAt: null,
        confirmedAt: null,
        checkedIn: false
      });
    }
    return guests;
  },

  // Toast Notification
  showToast(message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    const bgColors = {
      success: 'bg-emerald-600 border-emerald-500',
      error: 'bg-rose-600 border-rose-500',
      info: 'bg-indigo-600 border-indigo-500',
      warning: 'bg-amber-600 border-amber-500'
    };

    toast.className = `${bgColors[type] || bgColors.info} text-white px-4 py-3 rounded-xl shadow-xl flex items-center justify-between gap-3 text-sm pointer-events-auto border animate-fade-in`;
    toast.innerHTML = `
      <div class="flex items-center gap-2">
        <span>${message}</span>
      </div>
      <button class="opacity-70 hover:opacity-100 font-bold ml-2">✕</button>
    `;

    toast.querySelector('button').addEventListener('click', () => toast.remove());
    container.appendChild(toast);

    setTimeout(() => {
      if (toast.parentNode) {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-10px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
      }
    }, 3500);
  }
};
