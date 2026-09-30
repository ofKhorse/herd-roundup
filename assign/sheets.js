const { GoogleAuth } = require("google-auth-library");

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];

async function readPeople(spreadsheetId) {
  const client = await authClient();
  const data = await request(
    client,
    "https://sheets.googleapis.com/v4/spreadsheets/" +
      spreadsheetId +
      "/values/people",
  );
  const values = data.values || [];
  if (values.length === 0) {
    throw new Error("The people tab is empty. Run the sheet migration first.");
  }
  const headers = values[0];
  return values.slice(1).map(function (row) {
    const record = {};
    headers.forEach(function (header, index) {
      record[header] = row[index] || "";
    });
    return {
      member_code: record.member_code,
      full_name: record.full_name || "",
      stay: record.stay || "",
      share_with: String(record.share_with || "")
        .split(",")
        .map(function (code) {
          return code.trim();
        })
        .filter(Boolean),
    };
  });
}

async function writeAssignment(spreadsheetId, result, people) {
  const client = await authClient();
  await ensureAssignmentTab(client, spreadsheetId);
  const names = {};
  people.forEach(function (person) {
    names[person.member_code] = person.full_name || "";
  });
  const rows = [["member_code", "full_name", "tipi_id", "tipi_size"]];
  result.tipis.forEach(function (tipi) {
    tipi.members.forEach(function (code) {
      rows.push([code, names[code] || "", tipi.id, String(tipi.size)]);
    });
  });
  result.unassigned.forEach(function (code) {
    rows.push([code, names[code] || "", "", ""]);
  });
  await request(
    client,
    "https://sheets.googleapis.com/v4/spreadsheets/" +
      spreadsheetId +
      "/values/assignment!A1?valueInputOption=RAW",
    { method: "PUT", data: { values: rows } },
  );
}

async function ensureAssignmentTab(client, spreadsheetId) {
  const spreadsheet = await request(
    client,
    "https://sheets.googleapis.com/v4/spreadsheets/" +
      spreadsheetId +
      "?fields=sheets.properties.title",
  );
  const titles = (spreadsheet.sheets || []).map(function (sheet) {
    return sheet.properties.title;
  });
  if (titles.indexOf("assignment") !== -1) {
    await request(
      client,
      "https://sheets.googleapis.com/v4/spreadsheets/" +
        spreadsheetId +
        "/values/assignment!A:Z:clear",
      { method: "POST", data: {} },
    );
    return;
  }
  await request(
    client,
    "https://sheets.googleapis.com/v4/spreadsheets/" +
      spreadsheetId +
      ":batchUpdate",
    {
      method: "POST",
      data: {
        requests: [{ addSheet: { properties: { title: "assignment" } } }],
      },
    },
  );
}

async function authClient() {
  const auth = new GoogleAuth({ scopes: SCOPES });
  return auth.getClient();
}

async function request(client, url, options) {
  const response = await client.request({
    url: url,
    method: (options && options.method) || "GET",
    data: options && options.data,
  });
  return response.data;
}

module.exports = { readPeople, writeAssignment };
