/**
 * Google Sheets Universal Connector & Synchronizer
 *
 * Supports:
 * 1. Direct Google Spreadsheet URLs (https://docs.google.com/spreadsheets/d/.../edit)
 * 2. Published Google Sheet CSV URLs (https://docs.google.com/spreadsheets/d/e/.../pub?output=csv)
 * 3. Google Apps Script Web App URLs (https://script.google.com/macros/s/.../exec)
 */

export class GoogleSheetSync {
  constructor(config = {}) {
    this.endpointUrl = config.endpointUrl || '';
    this.sheetCsvUrl = config.sheetCsvUrl || '';
  }

  // Convert ANY user-provided URL to the optimal working endpoint
  static resolveUrl(inputUrl) {
    if (!inputUrl) return { type: 'unknown', url: '' };

    const trimmed = inputUrl.trim();

    // 1. Google Apps Script Web App
    if (trimmed.includes('script.google.com')) {
      return { type: 'appsscript', url: trimmed };
    }

    // 2. Direct Google Spreadsheet Link (edit, view, or gviz)
    const sheetIdMatch = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (sheetIdMatch) {
      const sheetId = sheetIdMatch[1];
      const gidMatch = trimmed.match(/[?&#]gid=([0-9]+)/);
      const gid = gidMatch ? gidMatch[1] : '0';

      // Use Google Visualization API CSV export - works seamlessly with public/shared sheets
      const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&gid=${gid}`;
      return { type: 'sheet_direct', sheetId, gid, url: csvUrl, original: trimmed };
    }

    // 3. Already a CSV URL
    if (trimmed.includes('output=csv') || trimmed.endsWith('.csv')) {
      return { type: 'csv', url: trimmed };
    }

    return { type: 'custom', url: trimmed };
  }

  // Test connection and return diagnostics with sample rows
  async testConnection(rawUrl) {
    const resolved = GoogleSheetSync.resolveUrl(rawUrl);

    try {
      if (resolved.type === 'appsscript') {
        const fetchUrl = resolved.url.includes('?') ? `${resolved.url}&action=getGuests` : `${resolved.url}?action=getGuests`;
        const res = await fetch(fetchUrl, { method: 'GET', redirect: 'follow' });
        if (!res.ok) throw new Error(`Le script Google a répondu avec le statut HTTP ${res.status}`);
        const data = await res.json();
        const guests = Array.isArray(data) ? data : (data.guests || []);

        return {
          success: true,
          type: 'Google Apps Script (Lecture & Écriture 2-Sens)',
          count: guests.length,
          preview: guests.slice(0, 5),
          rawGuests: guests.map(g => ({
            id: g.id || ('g_' + Math.random().toString(36).substring(2, 8)),
            name: String(g.name || '').trim(),
            category: String(g.category || 'Général').trim(),
            status: this.normalizeStatus(g.status),
            invitedAt: g.invitedAt || null,
            comment: String(g.comment || '').trim()
          }))
        };
      }

      // For Sheet Direct or CSV
      const targetUrl = resolved.url;
      const res = await fetch(targetUrl, { redirect: 'follow' });
      if (!res.ok) {
        if (res.status === 401 || res.status === 403 || res.status === 404) {
          throw new Error(`Accès refusé (${res.status}). Assurez-vous que votre feuille est bien partagée : dans Google Sheets, cliquez sur "Partager" > "Tous les utilisateurs disposant du lien" (Lecteur).`);
        }
        throw new Error(`Impossible de lire la feuille (Statut HTTP ${res.status})`);
      }

      const text = await res.text();
      // Check if Google returned an HTML login page instead of CSV
      if (text.trim().startsWith('<!DOCTYPE html>') || text.includes('accounts.google.com')) {
        throw new Error('Votre Google Sheet demande une connexion. Cliquez sur "Partager" dans Google Sheets et choisissez : "Tous les utilisateurs disposant du lien peuvent consulter".');
      }

      const parsed = this.parseSheetCSV(text);
      if (parsed.guests.length === 0) {
        throw new Error('Aucun nom trouvé dans le tableau. Vérifiez que votre tableau contient au moins une colonne "Nom" ou "Prénom".');
      }

      return {
        success: true,
        type: 'Google Spreadsheet (Lecture directe)',
        count: parsed.guests.length,
        detectedHeaders: parsed.detectedHeaders,
        preview: parsed.guests.slice(0, 5),
        rawGuests: parsed.guests
      };

    } catch (err) {
      return {
        success: false,
        error: err.message || String(err)
      };
    }
  }

  // Send update to Google Sheet via Google Apps Script Web App
  async saveGuestToSheet(guest, url = this.endpointUrl) {
    if (!url || !url.includes('script.google.com')) return null;

    try {
      await fetch(url, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'upsertGuest',
          guest
        })
      });
      return true;
    } catch (err) {
      console.warn('Sync to Google Sheet failed:', err);
      return false;
    }
  }

  // Parse CSV text with high tolerance for varied column names
  parseSheetCSV(csvText) {
    const rawLines = csvText.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (rawLines.length === 0) return { guests: [], detectedHeaders: [] };

    // Helper to parse CSV row respecting quotes
    const parseRow = (line) => {
      const result = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"') {
          if (inQuotes && line[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (c === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += c;
        }
      }
      result.push(current.trim());
      return result;
    };

    const headerRow = parseRow(rawLines[0]);
    const headers = headerRow.map(h => h.toLowerCase().replace(/[^a-z0-9à-ÿ]/g, ''));

    // Dynamic column finding
    const prenomIdx = headers.findIndex(h => h.includes('prenom') || h.includes('firstname'));
    const nomIdx = headers.findIndex(h => h === 'nom' || h.includes('lastname') || h.includes('famille'));
    const fullNameIdx = headers.findIndex(h => h.includes('nomcomplet') || h.includes('fullname') || h.includes('invite') || h.includes('personne') || h.includes('contact') || h.includes('nom'));
    
    const categoryIdx = headers.findIndex(h => h.includes('groupe') || h.includes('categorie') || h.includes('cat') || h.includes('cote') || h.includes('table') || h.includes('cercle') || h.includes('relation'));
    const statusIdx = headers.findIndex(h => h.includes('statut') || h.includes('status') || h.includes('invite') || h.includes('presence') || h.includes('etat') || h.includes('reponse') || h.includes('decision') || h.includes('confir'));
    const dateIdx = headers.findIndex(h => h.includes('date') || h.includes('timestamp') || h.includes('quand'));
    const noteIdx = headers.findIndex(h => h.includes('commentaire') || h.includes('comment') || h.includes('note') || h.includes('remarque') || h.includes('raison') || h.includes('motif') || h.includes('pourquoi'));

    const detected = [];
    if (prenomIdx !== -1 && nomIdx !== -1) detected.push(`Prénom (${headerRow[prenomIdx]}) + Nom (${headerRow[nomIdx]})`);
    else if (fullNameIdx !== -1) detected.push(`Nom (${headerRow[fullNameIdx]})`);
    if (categoryIdx !== -1) detected.push(`Groupe (${headerRow[categoryIdx]})`);
    if (statusIdx !== -1) detected.push(`Statut (${headerRow[statusIdx]})`);
    if (noteIdx !== -1) detected.push(`Commentaire (${headerRow[noteIdx]})`);

    const guests = [];

    for (let i = 1; i < rawLines.length; i++) {
      const row = parseRow(rawLines[i]);
      const val = (idx) => (idx !== -1 && row[idx]) ? row[idx].trim() : '';

      // Determine Name
      let name = '';
      if (prenomIdx !== -1 && nomIdx !== -1 && (row[prenomIdx] || row[nomIdx])) {
        name = `${val(prenomIdx)} ${val(nomIdx)}`.trim();
      } else if (fullNameIdx !== -1) {
        name = val(fullNameIdx);
      } else if (nomIdx !== -1) {
        name = val(nomIdx);
      } else {
        // Fallback to first non-empty column
        name = val(0) || val(1);
      }

      if (!name || name.toLowerCase() === 'nom' || name.toLowerCase() === 'prénom') continue;

      const rawStatus = val(statusIdx);
      const status = this.normalizeStatus(rawStatus);

      guests.push({
        id: 'gs_' + i + '_' + name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 10),
        name,
        category: val(categoryIdx) || 'Général',
        status,
        invitedAt: val(dateIdx) || (status === 'invited' ? new Date().toISOString() : null),
        comment: val(noteIdx) || ''
      });
    }

    return { guests, detectedHeaders: detected };
  }

  // Universal status normalizer
  normalizeStatus(val) {
    if (!val) return 'pending';
    const s = String(val).toLowerCase().trim();

    if (
      s === 'invited' ||
      s === 'invité' ||
      s === 'invite' ||
      s === 'oui' ||
      s === 'yes' ||
      s === '1' ||
      s === 'true' ||
      s === 'x' ||
      s.includes('invit') ||
      s.includes('confirm') ||
      s.includes('valid') ||
      s.includes('présent') ||
      s.includes('present')
    ) {
      return 'invited';
    }

    if (
      s === 'declined' ||
      s === 'non' ||
      s === 'no' ||
      s === '0' ||
      s === 'false' ||
      s.includes('écart') ||
      s.includes('ecart') ||
      s.includes('refus') ||
      s.includes('pas invité') ||
      s.includes('ne pas') ||
      s.includes('absent')
    ) {
      return 'declined';
    }

    return 'pending';
  }
}
