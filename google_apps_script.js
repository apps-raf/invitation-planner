/**
 * =====================================================================
 * Google Apps Script - Synchronisation 2-Sens pour InviTrack (v2)
 * =====================================================================
 * 
 * Ce script lit et met à jour votre Google Spreadsheet automatiquement,
 * quel que soit l'ordre de vos colonnes !
 *
 * Déploiement :
 * 1. Ouvrez votre Google Spreadsheet.
 * 2. Extensions > Apps Script.
 * 3. Collez ce code, puis cliquez sur : Déployer > Nouveau déploiement.
 *    - Type : Application Web
 *    - Exécuter en tant que : Moi
 *    - Qui a accès : Tout le monde (Anyone)
 * 4. Copiez l'URL de l'application Web et collez-la dans InviTrack !
 */

function doGet(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var data = sheet.getDataRange().getValues();

  if (data.length <= 1) {
    return ContentService.createTextOutput(JSON.stringify([]))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // 1. Locate column indices dynamically
  var headers = data[0].map(function(h) { 
    return String(h).toLowerCase().replace(/[^a-z0-9]/g, ''); 
  });

  var prenomIdx = findHeaderIndex(headers, ['prenom', 'firstname']);
  var nomIdx = findHeaderIndex(headers, ['nom', 'lastname', 'famille']);
  var fullNameIdx = findHeaderIndex(headers, ['nomcomplet', 'fullname', 'invite', 'personne', 'contact']);
  var catIdx = findHeaderIndex(headers, ['groupe', 'categorie', 'cat', 'cote', 'table', 'cercle']);
  var statusIdx = findHeaderIndex(headers, ['statut', 'status', 'invite', 'presence', 'etat', 'reponse', 'decision']);
  var dateIdx = findHeaderIndex(headers, ['date', 'timestamp', 'quand']);
  var noteIdx = findHeaderIndex(headers, ['commentaire', 'comment', 'note', 'remarque', 'raison', 'motif']);

  var guests = [];

  for (var i = 1; i < data.length; i++) {
    var row = data[i];

    // Determine Name
    var name = '';
    if (prenomIdx !== -1 && nomIdx !== -1 && (row[prenomIdx] || row[nomIdx])) {
      name = (String(row[prenomIdx] || '') + ' ' + String(row[nomIdx] || '')).trim();
    } else if (fullNameIdx !== -1 && row[fullNameIdx]) {
      name = String(row[fullNameIdx]).trim();
    } else if (nomIdx !== -1 && row[nomIdx]) {
      name = String(row[nomIdx]).trim();
    } else {
      name = String(row[0] || '').trim();
    }

    if (!name || name.toLowerCase() === 'nom' || name.toLowerCase() === 'prénom') continue;

    var rawStatus = statusIdx !== -1 ? String(row[statusIdx] || '') : 'pending';
    var normStatus = normalizeScriptStatus(rawStatus);

    var rawDate = dateIdx !== -1 && row[dateIdx] ? row[dateIdx] : null;
    var dateStr = null;
    if (rawDate instanceof Date) {
      dateStr = Utilities.formatDate(rawDate, Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss'Z'");
    } else if (rawDate) {
      dateStr = String(rawDate);
    }

    guests.push({
      id: "gs_" + i,
      name: name,
      category: catIdx !== -1 ? String(row[catIdx] || 'Général') : 'Général',
      status: normStatus,
      invitedAt: dateStr,
      comment: noteIdx !== -1 ? String(row[noteIdx] || '') : ''
    });
  }

  return ContentService.createTextOutput(JSON.stringify(guests))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var data = sheet.getDataRange().getValues();

    if (payload.action === "upsertGuest" && payload.guest) {
      var guest = payload.guest;

      var headers = data[0].map(function(h) { 
        return String(h).toLowerCase().replace(/[^a-z0-9]/g, ''); 
      });

      var statusIdx = findHeaderIndex(headers, ['statut', 'status', 'presence', 'decision']);
      var dateIdx = findHeaderIndex(headers, ['date', 'timestamp']);
      var noteIdx = findHeaderIndex(headers, ['commentaire', 'comment', 'note', 'remarque', 'raison']);

      // Default columns if not found
      if (statusIdx === -1) statusIdx = 2; // Column C
      if (dateIdx === -1) dateIdx = 3;     // Column D
      if (noteIdx === -1) noteIdx = 4;     // Column E

      var foundRow = -1;
      for (var i = 1; i < data.length; i++) {
        var rowName = String(data[i][0] || '') + ' ' + String(data[i][1] || '');
        if (rowName.toLowerCase().indexOf(guest.name.toLowerCase().trim()) !== -1 ||
            String(data[i][0] || '').toLowerCase().trim() === guest.name.toLowerCase().trim()) {
          foundRow = i + 1;
          break;
        }
      }

      var dateStr = guest.invitedAt ? new Date(guest.invitedAt).toLocaleString("fr-FR") : "";

      if (foundRow > 0) {
        sheet.getRange(foundRow, statusIdx + 1).setValue(guest.status);
        if (guest.status === 'invited') {
          sheet.getRange(foundRow, dateIdx + 1).setValue(dateStr);
        } else {
          sheet.getRange(foundRow, dateIdx + 1).clearContent();
        }
        if (guest.comment !== undefined) {
          sheet.getRange(foundRow, noteIdx + 1).setValue(guest.comment);
        }
      } else {
        // Append new row
        sheet.appendRow([guest.name, guest.category || "Général", guest.status, dateStr, guest.comment || ""]);
      }

      return ContentService.createTextOutput(JSON.stringify({ success: true }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({ success: false, message: "Action non reconnue" }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function findHeaderIndex(headers, candidates) {
  for (var i = 0; i < headers.length; i++) {
    for (var j = 0; j < candidates.length; j++) {
      if (headers[i].indexOf(candidates[j]) !== -1) return i;
    }
  }
  return -1;
}

function normalizeScriptStatus(val) {
  if (!val) return 'pending';
  var s = String(val).toLowerCase().trim();
  if (s === 'invited' || s === 'invité' || s === 'oui' || s === 'yes' || s === '1' || s.indexOf('invit') !== -1) return 'invited';
  if (s === 'declined' || s === 'non' || s === '0' || s.indexOf('écart') !== -1 || s.indexOf('refus') !== -1) return 'declined';
  return 'pending';
}
