const fs = require("node:fs");
const { assignTipis } = require("./tipis");

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.sizes || (!args.input && !args.sheet)) {
    console.log(
      "Usage: node assign/cli.js --sizes 5x12,4x8 (--input people.csv | --sheet SPREADSHEET_ID) [--output assignment.csv]",
    );
    process.exit(1);
  }
  const sheets = args.sheet ? require("./sheets") : null;
  const people = args.sheet
    ? await sheets.readPeople(args.sheet)
    : peopleFromCsv(fs.readFileSync(args.input, "utf8"));
  const result = assignTipis(people, args.sizes);
  const csv = toCsv(result, people);
  fs.writeFileSync(args.output || "assignment.csv", csv);
  if (args.sheet) {
    await sheets.writeAssignment(args.sheet, result, people);
  }
  console.log(
    "Assigned " +
      result.tipis.reduce(function (sum, tipi) {
        return sum + tipi.members.length;
      }, 0) +
      " people into " +
      result.tipis.length +
      " tipis. Unassigned: " +
      result.unassigned.length +
      ". Conflicts: " +
      result.conflicts.length +
      ".",
  );
  result.conflicts.forEach(function (codes) {
    console.log("Conflict, bigger than every tipi: " + codes.join(", "));
  });
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const name = argv[i];
    const value = argv[i + 1];
    if (name === "--sizes") {
      args.sizes = parseSizes(value);
      i++;
    } else if (name === "--input") {
      args.input = value;
      i++;
    } else if (name === "--sheet") {
      args.sheet = value;
      i++;
    } else if (name === "--output") {
      args.output = value;
      i++;
    }
  }
  return args;
}

function parseSizes(text) {
  return String(text)
    .split(",")
    .filter(Boolean)
    .flatMap(function (part) {
      const match = /^(\d+)x(\d+)$/.exec(part);
      if (match) {
        return Array(Number(match[2])).fill(Number(match[1]));
      }
      return [Number(part)];
    });
}

function peopleFromCsv(text) {
  const rows = parseCsv(text).filter(function (row) {
    return row.some(function (cell) {
      return cell !== "";
    });
  });
  const headers = rows[0];
  return rows.slice(1).map(function (row) {
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

function toCsv(result, people) {
  const names = {};
  people.forEach(function (person) {
    names[person.member_code] = person.full_name || "";
  });
  const lines = ["member_code,full_name,tipi_id,tipi_size"];
  result.tipis.forEach(function (tipi) {
    tipi.members.forEach(function (code) {
      lines.push(
        [code, csvCell(names[code] || ""), tipi.id, tipi.size].join(","),
      );
    });
  });
  result.unassigned.forEach(function (code) {
    lines.push([code, csvCell(names[code] || ""), "", ""].join(","));
  });
  return lines.join("\n") + "\n";
}

function csvCell(value) {
  if (/[",\n]/.test(value)) {
    return '"' + value.replace(/"/g, '""') + '"';
  }
  return value;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") {
      cell += char;
    }
  }
  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

if (require.main === module) {
  main().catch(function (error) {
    console.error(error.message);
    process.exit(1);
  });
}

module.exports = { parseSizes, peopleFromCsv, toCsv };
