function migration002AddWhatsapp_(ss) {
  appendHeader_(sheetFor_(ss, "people"), "whatsapp");
}

function appendHeader_(sheet, header) {
  var width = Math.max(sheet.getLastColumn(), 1);
  var headers = sheet.getRange(1, 1, 1, width).getValues()[0];
  for (var column = 0; column < headers.length; column++) {
    if (String(headers[column]) === header) {
      return;
    }
  }
  var next = headers.length === 1 && headers[0] === "" ? 1 : width + 1;
  sheet.getRange(1, next).setValue(header);
  sheet.getRange(1, next).setFontWeight("bold");
}
