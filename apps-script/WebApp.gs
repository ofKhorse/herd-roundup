/**
 * Deploy as a web app: execute as me, anyone can access.
 * The page posts JSON as text/plain. doPost answers every action in logic.gs.
 */

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var body = JSON.parse(e.postData.contents);
    return jsonOutput_(
      handleAction(body, sheetDatabase_(), {
        now: function () {
          return new Date().toISOString();
        },
        sendPassword: function (email, password) {
          MailApp.sendEmail(
            email,
            "Your ofKhorse password",
            "Your password is " + password,
          );
        },
      }),
    );
  } catch (error) {
    return jsonOutput_({ ok: false, error: error.message });
  } finally {
    lock.releaseLock();
  }
}

function sheetDatabase_() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("people");
  if (!sheet) {
    throw new Error("Run runMigrations first.");
  }
  return {
    listPeople: function () {
      return readPeople_(sheet).map(fromSheetPerson_);
    },
    insertPerson: function (person) {
      appendPerson_(sheet, toSheetPerson_(person));
    },
    updatePerson: function (memberCode, fields) {
      updatePersonRow_(sheet, memberCode, toSheetPerson_(fields));
    },
  };
}

function readPeople_(sheet) {
  var values = sheet.getDataRange().getValues();
  if (values.length < 2) {
    return [];
  }
  var headers = values[0];
  var people = [];
  for (var row = 1; row < values.length; row++) {
    var blank = true;
    var person = {};
    for (var column = 0; column < headers.length; column++) {
      person[headers[column]] = values[row][column];
      if (values[row][column] !== "") {
        blank = false;
      }
    }
    if (!blank) {
      people.push(person);
    }
  }
  return people;
}

function appendPerson_(sheet, person) {
  var headers = headerRow_(sheet);
  sheet.appendRow(
    headers.map(function (header) {
      return person[header] === undefined || person[header] === null
        ? ""
        : person[header];
    }),
  );
}

function updatePersonRow_(sheet, memberCode, fields) {
  var headers = headerRow_(sheet);
  var codeColumn = headers.indexOf("member_code");
  var values = sheet.getDataRange().getValues();
  for (var row = 1; row < values.length; row++) {
    if (String(values[row][codeColumn]) !== String(memberCode)) {
      continue;
    }
    Object.keys(fields).forEach(function (key) {
      var column = headers.indexOf(key);
      if (column !== -1) {
        sheet.getRange(row + 1, column + 1).setValue(fields[key]);
      }
    });
    return;
  }
  throw new Error("That member code is not registered.");
}

function headerRow_(sheet) {
  return sheet
    .getRange(1, 1, 1, sheet.getLastColumn())
    .getValues()[0]
    .map(function (header) {
      return String(header);
    });
}

function fromSheetPerson_(person) {
  var copy = {};
  Object.keys(person).forEach(function (key) {
    copy[key] = person[key];
  });
  copy.share_with = String(person.share_with || "")
    .split(",")
    .map(function (code) {
      return code.trim();
    })
    .filter(function (code) {
      return code !== "";
    });
  return copy;
}

function toSheetPerson_(person) {
  var copy = {};
  Object.keys(person).forEach(function (key) {
    copy[key] = person[key];
  });
  if (Array.isArray(person.share_with)) {
    copy.share_with = person.share_with.join(",");
  }
  return copy;
}

function jsonOutput_(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(
    ContentService.MimeType.JSON,
  );
}
