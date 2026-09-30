function migration003HashPasswords_(ss) {
  var sheet = sheetFor_(ss, "people");
  var width = Math.max(sheet.getLastColumn(), 1);
  var headers = sheet.getRange(1, 1, 1, width).getValues()[0];
  var column = -1;
  for (var i = 0; i < headers.length; i++) {
    if (String(headers[i]) === "password") {
      column = i;
    }
  }
  if (column === -1) {
    throw new Error("The people sheet has no password column.");
  }
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return;
  }
  var range = sheet.getRange(2, column + 1, lastRow - 1, 1);
  range.setValues(hashPlainPasswords_(range.getValues()));
}
