/**
 * Google Sheets 2-Way Sync Module
 *
 * Supports:
 * 1. Google Apps Script Web App (Full Read + Write in real time)
 * 2. Published Google Sheet CSV (Direct Live Read)
 */

export class GoogleSheetSync {
  constructor(config = {}) {
    this.endpointUrl = config.endpointUrl || '';
    this.sheetCsvUrl = config.sheetCsvUrl || '';
  }

  // Fetch guests from Google Sheet via Apps Script Web App
  async fetchFromAppsScript(url = this.endpointUrl) {
    if (!url) throw new Error('URL du Web App Google Apps Script manquante');

    const res = await fetch(`${url}?action=getGuests`, {
      method: 'GET',
      mode: 'cors'
    });

    if (!res.ok) throw new Error(`Erreur réseau (${res.status})`);
    const data = await res.json();
    return data; // Array of guests
  }

  // Send update to Google Sheet (e.g. status change, comment, date, or new guest)
  async saveGuestToSheet(guest, url = this.endpointUrl) {
    if (!url) return null;

    try {
      const res = await fetch(url, {
        method: 'POST',
        mode: 'no-cors', // standard for Google Apps Script Web App redirects
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'upsertGuest',
          guest
        })
      });
      return true;
    } catch (err) {
      console.warn('Sync to Google Sheet failed, saved locally:', err);
      return false;
    }
  }

  // Fetch directly from a "Published to Web" Google Sheet (CSV format)
  async fetchFromPublishedCSV(csvUrl = this.sheetCsvUrl) {
    if (!csvUrl) throw new Error('URL CSV de la feuille manquante');

    const res = await fetch(csvUrl);
    if (!res.ok) throw new Error('Impossible de lire la feuille Google Sheets');

    const text = await res.text();
    return this.parseSheetCSV(text);
  }

  parseSheetCSV(csvText) {
    const lines = csvText.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, '').toLowerCase());
    const nameIdx = headers.findIndex(h => h.includes('nom') || h.includes('name'));
    const statusIdx = headers.findIndex(h => h.includes('statut') || h.includes('status') || h.includes('invit'));
    const groupIdx = headers.findIndex(h => h.includes('groupe') || h.includes('cat') || h.includes('famille'));
    const dateIdx = headers.findIndex(h => h.includes('date'));
    const noteIdx = headers.findIndex(h => h.includes('note') || h.includes('comment') || h.includes('raison'));

    const list = [];
    for (let i = 1; i < lines.length; i++) {
      const row = lines[i].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || lines[i].split(',');
      const val = (idx) => idx !== -1 && row[idx] ? row[idx].trim().replace(/^"|"$/g, '').trim() : '';

      const name = nameIdx !== -1 ? val(nameIdx) : val(0);
      if (!name) continue;

      const rawStatus = (val(statusIdx) || '').toLowerCase();
      let status = 'pending';
      if (rawStatus.includes('oui') || rawStatus.includes('invit') || rawStatus.includes('yes')) {
        status = 'invited';
      } else if (rawStatus.includes('non') || rawStatus.includes('refus') || rawStatus.includes('écart') || rawStatus.includes('no')) {
        status = 'declined';
      }

      list.push({
        id: 'g_' + i + '_' + name.toLowerCase().replace(/[^a-z0-9]/g, ''),
        name,
        category: val(groupIdx) || 'Général',
        status, // 'invited' | 'pending' | 'declined'
        invitedAt: val(dateIdx) || (status === 'invited' ? new Date().toISOString() : null),
        comment: val(noteIdx) || ''
      });
    }
    return list;
  }
}
