function migration007ForceSheetText_(ss) {
  var sheet = sheetFor_(ss, "people");
  var lastRow = sheet.getLastRow();
  var lastColumn = sheet.getLastColumn();
  if (lastRow < 2 || lastColumn < 1) {
    return;
  }
  var range = sheet.getRange(2, 1, lastRow - 1, lastColumn);
  var formulas = range.getFormulas();
  for (var row = 0; row < formulas.length; row++) {
    for (var column = 0; column < formulas[row].length; column++) {
      var formula = formulas[row][column];
      if (formula && formula.charAt(0) === "=") {
        range.getCell(row + 1, column + 1).setValue(sheetText_(formula));
      }
    }
  }
}
