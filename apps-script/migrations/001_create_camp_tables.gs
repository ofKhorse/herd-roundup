var PEOPLE_HEADERS = [
  "member_code",
  "email",
  "password",
  "full_name",
  "admin",
  "stay",
  "purchased",
  "purchased_size",
  "purchased_at",
  "boomer_id",
  "share_with",
  "camp_fee_paid",
  "amount",
  "payment_ref",
];

var PAYMENTS_HEADERS = [
  "transfer_id",
  "received_at",
  "amount",
  "currency",
  "reference",
  "payer_name",
  "member_code",
];

function migration001CreateCampTables_(ss) {
  writeHeadersIfEmpty_(sheetFor_(ss, "people"), PEOPLE_HEADERS);
  writeHeadersIfEmpty_(sheetFor_(ss, "payments"), PAYMENTS_HEADERS);
}

function sheetFor_(ss, name) {
  var existing = ss.getSheetByName(name);
  if (existing) {
    return existing;
  }
  var unused = unusedSheet_(ss);
  if (name === "people" && unused) {
    unused.setName(name);
    return unused;
  }
  return ss.insertSheet(name);
}

function writeHeadersIfEmpty_(sheet, headers) {
  var current = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  var same = headers.every(function (header, index) {
    return current[index] === header;
  });
  if (same) {
    sheet.setFrozenRows(1);
    return;
  }
  var hasAny = current.some(function (cell) {
    return cell !== "";
  });
  if (hasAny) {
    throw new Error(
      "Row 1 of " +
        sheet.getName() +
        " already has different headers. Nothing was changed.",
    );
  }
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
  sheet.setFrozenRows(1);
}

function unusedSheet_(ss) {
  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    var name = sheets[i].getName();
    if (name === "migrations" || name === "people" || name === "payments") {
      continue;
    }
    if (isUnused_(sheets[i])) {
      return sheets[i];
    }
  }
  return null;
}

function isUnused_(sheet) {
  var values = sheet.getDataRange().getValues();
  return values.length === 1 && values[0].length === 1 && values[0][0] === "";
}
