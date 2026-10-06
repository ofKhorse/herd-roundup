function migration006RemoveBoomerId_(ss) {
  var sheet = sheetFor_(ss, "people");
  var lastColumn = sheet.getLastColumn();
  if (lastColumn < 1) {
    return;
  }
  var headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
  var index = headers.indexOf("boomer_id");
  if (index === -1) {
    return;
  }
  sheet.deleteColumn(index + 1);
}
