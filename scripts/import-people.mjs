import { readFileSync } from "node:fs";
import { recordsFromCsv } from "./people-import.mjs";

const project = "herd-roundup-e7f31";

const args = parseArgs(process.argv.slice(2));
if (!args.csv) {
  console.error(
    "Usage: node scripts/import-people.mjs <people.csv> [--write] [--credentials <file>]",
  );
  process.exit(1);
}

let text;
try {
  text = readFileSync(args.csv, "utf8");
} catch (error) {
  console.error(
    error && error.code === "ENOENT"
      ? `Could not read ${args.csv}.`
      : error.message,
  );
  process.exit(1);
}
const parsed = recordsFromCsv(text);
for (const error of parsed.errors) console.error(error);
const admins = parsed.records
  .filter((record) => record.person.admin)
  .map((record) => record.email);
console.log(`${parsed.records.length} campers`);
console.log(`next kode number ${parsed.next}`);
console.log(admins.length ? `admins: ${admins.join(", ")}` : "admins: none");
if (parsed.errors.length > 0) process.exit(1);
if (!args.write) {
  console.log(
    "No data was written. Run the same command with --write to import.",
  );
  process.exit(0);
}

process.env.METADATA_SERVER_DETECTION =
  process.env.METADATA_SERVER_DETECTION || "none";
if (args.credentials)
  process.env.GOOGLE_APPLICATION_CREDENTIALS = args.credentials;

const { GoogleAuth } = await import("google-auth-library");
let client;
try {
  client = await new GoogleAuth({
    scopes: ["https://www.googleapis.com/auth/cloud-platform"],
  }).getClient();
} catch (error) {
  console.error(
    "Google rejected the saved login. Sign in as the account that owns the Firebase project, then run this command again:",
  );
  console.error("  gcloud auth application-default login");
  process.exit(1);
}

async function api(options) {
  try {
    return await client.request(options);
  } catch (error) {
    const grant =
      error &&
      error.response &&
      error.response.data &&
      error.response.data.error;
    if (grant === "invalid_grant") {
      console.error(
        "Google rejected the saved login. Sign in as the account that owns the Firebase project, then run this command again:",
      );
      console.error("  gcloud auth application-default login");
      process.exit(1);
    }
    throw error;
  }
}

const groups = new Map();
for (const record of parsed.records) {
  const group = groups.get(record.rounds) || [];
  group.push(record);
  groups.set(record.rounds, group);
}

let created = 0;
let existing = 0;
for (const [rounds, records] of groups) {
  for (let start = 0; start < records.length; start += 100) {
    const batch = records.slice(start, start + 100);
    const response = await api({
      url: `https://identitytoolkit.googleapis.com/v1/projects/${project}/accounts:batchCreate`,
      method: "POST",
      data: {
        hashAlgorithm: "PBKDF2_SHA256",
        rounds,
        users: batch.map(function (record) {
          return {
            localId: record.uid,
            email: record.email,
            passwordHash: record.hash,
            salt: record.salt,
          };
        }),
      },
    });
    const failures = (response.data && response.data.error) || [];
    const failed = new Set(failures.map((failure) => failure.index));
    created += batch.length - failed.size;
    for (const failure of failures) {
      const record = batch[failure.index];
      if (!/EMAIL_EXISTS|DUPLICATE_/i.test(failure.message || "")) {
        throw new Error(
          `Could not import ${record.email}: ${failure.message || "unknown error"}`,
        );
      }
      const lookup = await api({
        url: `https://identitytoolkit.googleapis.com/v1/projects/${project}/accounts:lookup`,
        method: "POST",
        data: { email: [record.email] },
      });
      const user = lookup.data && lookup.data.users && lookup.data.users[0];
      if (!user || !user.localId) {
        throw new Error(
          `Could not find the existing sign-in for ${record.email}.`,
        );
      }
      record.uid = user.localId;
      existing += 1;
    }
  }
}

const writes = [];
for (const record of parsed.records) {
  writes.push(documentWrite(`people/${record.uid}`, record.person));
  writes.push(documentWrite(`directory/${record.uid}`, record.directory));
}
writes.push(
  documentWrite("counters/member", {
    next: parsed.next,
  }),
);
for (let start = 0; start < writes.length; start += 400) {
  await api({
    url: `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents:commit`,
    method: "POST",
    data: { writes: writes.slice(start, start + 400) },
  });
}

console.log(`Created ${created} sign-ins, kept ${existing} existing sign-ins.`);
console.log(`Wrote ${parsed.records.length} profiles.`);

function documentWrite(path, data) {
  return {
    update: {
      name: `projects/${project}/databases/(default)/documents/${path}`,
      fields: fieldsFor(data),
    },
  };
}

function fieldsFor(data) {
  const fields = {};
  for (const [key, value] of Object.entries(data)) {
    fields[key] = fieldValue(value);
  }
  return fields;
}

function fieldValue(value) {
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") return { integerValue: String(value) };
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map(fieldValue) } };
  }
  return { stringValue: value == null ? "" : String(value) };
}

function parseArgs(argv) {
  const parsed = { csv: "", write: false, credentials: "" };
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === "--write") parsed.write = true;
    else if (arg === "--credentials") parsed.credentials = argv[++index] || "";
    else if (!parsed.csv) parsed.csv = arg;
    else {
      console.error(`Unexpected argument: ${arg}`);
      process.exit(1);
    }
  }
  return parsed;
}
