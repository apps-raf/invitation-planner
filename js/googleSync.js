/**
 * Google Sheets Universal Connector & Synchronizer (v3)
 *
 * Supports:
 * 1. Direct Google Spreadsheet URLs (https://docs.google.com/spreadsheets/d/.../edit)
 * 2. Published Google Sheet CSV URLs (https://docs.google.com/spreadsheets/d/e/.../pub?output=csv)
 * 3. Google Apps Script Web App URLs (https://script.google.com/macros/s/.../exec)
 * 4. Specific structure matching: Catégorie, Nom_Famille, Branche, Sexe, Nom_Prenom_Info, Invitation Sent
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
      if (text.trim().startsWith('<!DOCTYPE html>') || text.includes('accounts.google.com')) {
        throw new Error('Votre Google Sheet demande une connexion. Cliquez sur "Partager" dans Google Sheets et choisissez : "Tous les utilisateurs disposant du lien peuvent consulter".');
      }

      const parsed = this.parseSheetCSV(text);
      if (parsed.guests.length === 0) {
        throw new Error('Aucun invité trouvé dans le tableau. Vérifiez que votre tableau contient des données.');
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

  // Parse CSV text with high tolerance for varied column structures
  parseSheetCSV(csvText) {
    const rawLines = csvText.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (rawLines.length === 0) return { guests: [], detectedHeaders: [] };

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

    // Check specific columns matching user's exact sheet
    const nomFamilleIdx = headers.findIndex(h => h.includes('nomfamille') || h === 'nom' || h.includes('famille'));
    const prenomInfoIdx = headers.findIndex(h => h.includes('nomprenominfo') || h.includes('prenom') || h.includes('info'));
    const brancheIdx = headers.findIndex(h => h.includes('branche'));
    const categorieIdx = headers.findIndex(h => h.includes('categorie') || h.includes('groupe') || h.includes('cat'));
    const invSentIdx = headers.findIndex(h => h.includes('invitationsent') || h.includes('statut') || h.includes('status') || h.includes('invite'));

    const detected = [];
    if (prenomInfoIdx !== -1 && nomFamilleIdx !== -1) detected.push(`Prénom/Info (${headerRow[prenomInfoIdx]}) + Nom (${headerRow[nomFamilleIdx]})`);
    else if (nomFamilleIdx !== -1) detected.push(`Nom (${headerRow[nomFamilleIdx]})`);
    if (categorieIdx !== -1) detected.push(`Catégorie (${headerRow[categorieIdx]})`);
    if (brancheIdx !== -1) detected.push(`Branche (${headerRow[brancheIdx]})`);

    const guests = [];

    for (let i = 1; i < rawLines.length; i++) {
      const row = parseRow(rawLines[i]);
      const val = (idx) => (idx !== -1 && row[idx]) ? row[idx].trim() : '';

      const famille = val(nomFamilleIdx);
      const prenomInfo = val(prenomInfoIdx);
      const branche = val(brancheIdx);
      const cat = val(categorieIdx);
      const invSent = val(invSentIdx);

      // Build Name
      let name = '';
      if (prenomInfo && prenomInfo.replace('.0', '').match(/^\d+$/)) {
        const num = prenomInfo.replace('.0', '');
        name = famille ? `${famille} #${num}` : `Invité #${num}`;
      } else if (prenomInfo && famille) {
        name = `${prenomInfo} ${famille}`;
      } else if (prenomInfo) {
        name = prenomInfo;
      } else if (famille) {
        name = famille;
      } else {
        name = val(0) || val(1);
      }

      if (!name || name.toLowerCase() === 'nom' || name.toLowerCase() === 'nom_famille') continue;

      let category = cat || 'Général';
      if (category === 'z Belle Famille') category = 'Belle Famille';
      else if (category.toUpperCase() === 'AMIS') category = 'Amis';
      else if (category.toUpperCase() === 'VOISINS') category = 'Voisins';

      let comment = '';
      if (branche && branche.toLowerCase() !== 'pending') {
        comment = `Branche: ${branche}`;
      }

      const status = this.normalizeStatus(invSent);

      guests.push({
        id: 'gs_' + i + '_' + name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 10),
        name,
        category,
        status,
        invitedAt: status === 'invited' ? new Date().toISOString() : null,
        comment
      });
    }

    return { guests, detectedHeaders: detected };
  }

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
      s.includes('valid')
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
      s.includes('ne pas')
    ) {
      return 'declined';
    }

    return 'pending';
  }
}
