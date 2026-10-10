/**
 * Standalone script. Deploy it from the Gmail that can view the Leetchi sheet.
 * Execute as: Me. Who has access: Anyone.
 * Paste the /exec URL into docs/config.js as PAYMENT_SCRIPT_URL.
 * Reads only the By contributor tab. Auth and profiles stay on Firebase.
 */
var PAYMENT_SHEET_ID = "1MlyzfM04W4z_U-I2n7KIou7GgHUIIlE9Mijh1QNR4fE";
var PAYMENT_API_KEY = "AIzaSyBovmleqj29b9pxm2PlB3wKnLiI7dnxJzM";
var PAYMENT_PROJECT = "herd-roundup-e7f31";

function doGet() {
  return ContentService.createTextOutput(
    "This reads the payment sheet for a signed-in admin.",
  );
}

function doPost(e) {
  try {
    var raw = e && e.postData && e.postData.contents;
    var body = JSON.parse(raw || "{}");
    if (!paymentAdmin_(body.idToken)) {
      return paymentJson_({ ok: false, error: "Not allowed." });
    }
    return paymentJson_({ ok: true, rows: paymentRows_() });
  } catch (err) {
    console.error(err);
    return paymentJson_({
      ok: false,
      error: "The payment sheet could not be read.",
    });
  }
}

function paymentAdmin_(token) {
  var idToken = String(token || "");
  if (!idToken || idToken.length > 4000) {
    return false;
  }
  var lookup = UrlFetchApp.fetch(
    "https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=" +
      PAYMENT_API_KEY,
    {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify({ idToken: idToken }),
      muteHttpExceptions: true,
    },
  );
  if (lookup.getResponseCode() !== 200) {
    return false;
  }
  var users = JSON.parse(lookup.getContentText()).users || [];
  if (!users.length || users[0].emailVerified !== true || !users[0].localId) {
    return false;
  }
  var person = UrlFetchApp.fetch(
    "https://firestore.googleapis.com/v1/projects/" +
      PAYMENT_PROJECT +
      "/databases/(default)/documents/people/" +
      encodeURIComponent(users[0].localId),
    {
      method: "get",
      headers: { Authorization: "Bearer " + idToken },
      muteHttpExceptions: true,
    },
  );
  if (person.getResponseCode() !== 200) {
    return false;
  }
  var fields = JSON.parse(person.getContentText()).fields || {};
  return !!(fields.admin && fields.admin.booleanValue === true);
}

function paymentRows_() {
  var book = SpreadsheetApp.openById(PAYMENT_SHEET_ID);
  var sheet = book.getSheetByName("By contributor") || paymentSheet_(book);
  var header = sheet && paymentHeader_(sheet);
  if (!header) {
    throw new Error("The By contributor tab has no header.");
  }
  var count = sheet.getLastRow() - header.row;
  if (count < 1) {
    return [];
  }
  var values = sheet
    .getRange(header.row + 1, 1, count, sheet.getLastColumn())
    .getValues();
  var rows = [];
  for (var i = 0; i < values.length; i++) {
    var line = values[i];
    var contributor = String(line[header.contributor] || "").trim();
    if (!contributor || contributor.toLowerCase() === "total") {
      continue;
    }
    rows.push({
      contributor: contributor,
      payments: header.payments < 0 ? 0 : line[header.payments],
      total: line[header.total],
      lastPayment: header.last < 0 ? "" : paymentCellText_(line[header.last]),
      kode: String(line[header.kode] || "").trim(),
    });
  }
  return rows;
}

function paymentSheet_(book) {
  var sheets = book.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    if (paymentHeader_(sheets[i])) {
      return sheets[i];
    }
  }
  return null;
}

function paymentHeader_(sheet) {
  var height = Math.min(sheet.getLastRow(), 15);
  var width = sheet.getLastColumn();
  if (!height || !width) {
    return null;
  }
  var values = sheet.getRange(1, 1, height, width).getValues();
  for (var row = 0; row < values.length; row++) {
    var found = {
      row: row + 1,
      contributor: -1,
      payments: -1,
      total: -1,
      last: -1,
      kode: -1,
    };
    for (var column = 0; column < values[row].length; column++) {
      var cell = String(values[row][column] || "")
        .trim()
        .toLowerCase();
      if (cell === "contributor") {
        found.contributor = column;
      } else if (cell === "payments") {
        found.payments = column;
      } else if (cell.indexOf("total") === 0 && cell.indexOf("€") !== -1) {
        found.total = column;
      } else if (cell.indexOf("last payment") === 0) {
        found.last = column;
      } else if (cell === "kh ref") {
        found.kode = column;
      }
    }
    if (found.contributor !== -1 && found.total !== -1 && found.kode !== -1) {
      return found;
    }
  }
  return null;
}

function paymentCellText_(value) {
  if (Object.prototype.toString.call(value) === "[object Date]") {
    return Utilities.formatDate(value, "Europe/Lisbon", "dd.MM.yyyy HH:mm");
  }
  return String(value || "").trim();
}

function paymentJson_(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(
    ContentService.MimeType.JSON,
  );
}
