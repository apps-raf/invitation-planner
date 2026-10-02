/**
 * =====================================================================
 * Google Apps Script - Synchronisation 2 Sens pour InviTrack
 * =====================================================================
 * 
 * Instructions d'installation simples :
 * 1. Ouvrez votre Google Spreadsheet.
 * 2. Cliquez sur : Extensions > Apps Script.
 * 3. Effacez le code existant et collez ce fichier en entier.
 * 4. Cliquez sur : Déployer > Nouveau déploiement.
 *    - Type : "Application Web"
 *    - Exécuter en tant que : "Moi"
 *    - Qui a accès : "Tout le monde" (Anyone)
 * 5. Cliquez sur "Déployer", autorisez l'accès, et copiez l'URL de l'application Web fournie.
 * 6. Collez cette URL dans l'application InviTrack (bouton Google Sheets 📊 en haut) !
 */

function doGet(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  setupHeadersIfNeeded(sheet);
  
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) {
    return ContentService.createTextOutput(JSON.stringify([]))
      .setMimeType(ContentService.MimeType.JSON);
  }

  var guests = [];
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (!row[0]) continue; // Ignore empty name rows

    guests.push({
      id: "gs_" + i,
      name: String(row[0] || ""),
      category: String(row[1] || "Général"),
      status: String(row[2] || "pending").toLowerCase(),
      invitedAt: row[3] ? Utilities.formatDate(new Date(row[3]), Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss'Z'") : null,
      comment: String(row[4] || "")
    });
  }

  return ContentService.createTextOutput(JSON.stringify(guests))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    setupHeadersIfNeeded(sheet);

    if (payload.action === "upsertGuest" && payload.guest) {
      var guest = payload.guest;
      var data = sheet.getDataRange().getValues();
      var foundRow = -1;

      // Find existing guest by name (case-insensitive)
      for (var i = 1; i < data.length; i++) {
        if (String(data[i][0]).toLowerCase().trim() === String(guest.name).toLowerCase().trim()) {
          foundRow = i + 1; // 1-indexed for SpreadsheetApp
          break;
        }
      }

      var dateStr = guest.invitedAt ? new Date(guest.invitedAt).toLocaleString("fr-FR") : "";

      if (foundRow > 0) {
        // Update existing row
        sheet.getRange(foundRow, 2).setValue(guest.category || "Général");
        sheet.getRange(foundRow, 3).setValue(guest.status || "pending");
        if (guest.status === "invited") {
          sheet.getRange(foundRow, 4).setValue(dateStr);
        } else if (guest.status === "declined" || guest.status === "pending") {
          sheet.getRange(foundRow, 4).clearContent();
        }
        sheet.getRange(foundRow, 5).setValue(guest.comment || "");
      } else {
        // Append new row
        sheet.appendRow([
          guest.name,
          guest.category || "Général",
          guest.status || "pending",
          guest.status === "invited" ? dateStr : "",
          guest.comment || ""
        ]);
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

function setupHeadersIfNeeded(sheet) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(["Nom", "Groupe", "Statut", "Date Invitation", "Commentaire"]);
    sheet.getRange(1, 1, 1, 5).setFontWeight("bold").setBackground("#EEF2FF");
  }
}
