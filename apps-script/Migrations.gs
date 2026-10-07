/**
 * Paste every file under apps-script/ into Extensions → Apps Script.
 * Select runMigrations and click Run. Approve access to the spreadsheet once.
 * Applied ids are stored on the migrations tab. A migration that throws is not recorded.
 */

function runMigrations() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var log = ensureMigrationLog_(ss);
  var applied = appliedMigrationIds_(log);
  migrations_().forEach(function (migration) {
    if (applied[migration.id]) {
      return;
    }
    migration.run(ss);
    log.appendRow([migration.id, new Date()]);
  });
  ss.setActiveSheet(log);
  ss.moveActiveSheet(ss.getSheets().length);
}

function migrations_() {
  return [
    { id: "001_create_camp_tables", run: migration001CreateCampTables_ },
    { id: "002_add_whatsapp", run: migration002AddWhatsapp_ },
    { id: "003_hash_passwords", run: migration003HashPasswords_ },
    { id: "004_add_sale_questions", run: migration004AddSaleQuestions_ },
    { id: "005_add_boomer_email", run: migration005AddBoomerEmail_ },
    { id: "006_remove_boomer_id", run: migration006RemoveBoomerId_ },
    { id: "007_force_sheet_text", run: migration007ForceSheetText_ },
  ];
}

function ensureMigrationLog_(ss) {
  var sheet = ss.getSheetByName("migrations");
  if (sheet) {
    return sheet;
  }
  sheet = ss.insertSheet("migrations");
  sheet.getRange(1, 1, 1, 2).setValues([["id", "applied_at"]]);
  sheet.getRange(1, 1, 1, 2).setFontWeight("bold");
  sheet.setFrozenRows(1);
  return sheet;
}

function appliedMigrationIds_(sheet) {
  var values = sheet.getDataRange().getValues();
  var applied = {};
  for (var row = 1; row < values.length; row++) {
    if (values[row][0] !== "") {
      applied[values[row][0]] = true;
    }
  }
  return applied;
}
