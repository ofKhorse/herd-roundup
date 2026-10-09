import { createHash } from "node:crypto";

const COLUMNS = [
  "member_code",
  "email",
  "password",
  "full_name",
  "admin",
  "stay",
  "purchased",
  "purchased_size",
  "purchased_at",
  "share_with",
  "camp_fee_paid",
  "amount",
  "payment_ref",
  "whatsapp",
  "boomer_email",
  "sale_available",
  "kaptain",
];

const PROFILE_KEYS = [
  "member_code",
  "email",
  "admin",
  "full_name",
  "stay",
  "purchased",
  "purchased_size",
  "purchased_at",
  "boomer_email",
  "share_with",
  "camp_fee_paid",
  "amount",
  "payment_ref",
  "whatsapp",
  "sale_available",
  "kaptain",
  "needs_ticket",
  "ticket_name",
  "ticket_email",
  "ticket_birth",
  "ticket_gender",
  "ticket_nationality",
  "ticket_residency",
];

export function parseCsv(text) {
  const source = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (quoted) {
      if (char === '"') {
        if (source[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

export function uidFor(email) {
  return createHash("sha256")
    .update(`herd:${email}`)
    .digest("hex")
    .slice(0, 28);
}

export function recordsFromCsv(text) {
  const table = parseCsv(text).filter(function (row, index) {
    return index === 0 || row.some((value) => value.trim() !== "");
  });
  if (table.length === 0) {
    return { records: [], errors: ["The CSV is empty."], next: 1 };
  }
  const headers = table[0].map((header) => header.trim());
  const missing = COLUMNS.filter((name) => !headers.includes(name));
  if (missing.length > 0) {
    return {
      records: [],
      errors: missing.map((name) => `The CSV is missing ${name}.`),
      next: 1,
    };
  }
  const records = [];
  const errors = [];
  const seenEmail = new Set();
  const seenCode = new Set();
  for (let index = 1; index < table.length; index++) {
    const data = {};
    headers.forEach(function (header, column) {
      data[header] = table[index][column] || "";
    });
    const built = recordFromRow(data, index + 1);
    if (built.error) {
      errors.push(built.error);
      continue;
    }
    if (seenEmail.has(built.record.email)) {
      errors.push(`Row ${index + 1} repeats ${built.record.email}.`);
    }
    if (seenCode.has(built.record.person.member_code)) {
      errors.push(
        `Row ${index + 1} repeats ${built.record.person.member_code}.`,
      );
    }
    seenEmail.add(built.record.email);
    seenCode.add(built.record.person.member_code);
    records.push(built.record);
  }
  return { records, errors, next: nextMemberNumber(records) };
}

export function nextMemberNumber(records) {
  let max = 0;
  for (const record of records) {
    const match = /^KH-(\d+)$/.exec(record.person.member_code);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return max + 1;
}

function recordFromRow(data, row) {
  const email = normalizeEmail(data.email);
  const who = isEmail(email) ? `${email}` : `row ${row}`;
  function fail(message) {
    return { error: `Row ${row} (${who}): ${message}` };
  }
  if (!isEmail(email)) return fail("Enter an email.");
  const code = cell(data.member_code);
  if (!/^KH-[0-9]{3,}$/.test(code)) return fail("Enter a member kode.");
  const password = passwordParts(cell(data.password));
  if (password.error) return fail(password.error);
  const name = cell(data.full_name);
  if (name.length >= 200) return fail("The name is too long.");
  const stay = cell(data.stay);
  if (!["", "4", "5", "6", "arrange"].includes(stay)) {
    return fail("Choose a sleeping preference.");
  }
  const phone = whatsapp(data.whatsapp);
  if (phone.error) return fail(phone.error);
  const boomer = normalizeEmail(data.boomer_email);
  if (boomer && !isEmail(boomer)) return fail("Enter the Boom email.");
  const mates = companions(data.share_with, code, stay);
  if (mates.error) return fail(mates.error);
  const bought = purchase(data);
  if (bought.error) return fail(bought.error);
  const sale = saleAnswer(data);
  if (sale.error) return fail(sale.error);
  const person = {
    member_code: code,
    email,
    admin: cell(data.admin).toLowerCase() === "yes",
    full_name: name,
    stay,
    purchased: bought.purchased,
    purchased_size: bought.purchased_size,
    purchased_at: bought.purchased_at,
    boomer_email: boomer,
    share_with: mates.codes,
    camp_fee_paid: cell(data.camp_fee_paid),
    amount: cell(data.amount),
    payment_ref: cell(data.payment_ref),
    whatsapp: phone.value,
    sale_available: sale.sale_available,
    kaptain: sale.kaptain,
    needs_ticket: sale.needs_ticket,
    ticket_name: sale.ticket_name,
    ticket_email: sale.ticket_email,
    ticket_birth: sale.ticket_birth,
    ticket_gender: sale.ticket_gender,
    ticket_nationality: sale.ticket_nationality,
    ticket_residency: sale.ticket_residency,
  };
  const keys = Object.keys(person);
  if (
    keys.length !== PROFILE_KEYS.length ||
    PROFILE_KEYS.some((key) => !keys.includes(key))
  ) {
    return fail("The profile is missing a field.");
  }
  return {
    record: {
      uid: uidFor(email),
      email,
      rounds: password.rounds,
      salt: password.salt,
      hash: password.hash,
      person,
      directory: {
        member_code: code,
        full_name: name,
        email: name ? "" : email,
        share_with: mates.codes,
      },
    },
  };
}

function cell(value) {
  let text = String(value || "");
  if (text.startsWith("'")) text = text.slice(1);
  return text.trim();
}

function normalizeEmail(value) {
  return cell(value).toLowerCase();
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function passwordParts(stored) {
  const match =
    /^pbkdf2_sha256\$(\d+)\$([A-Za-z0-9+/]+={0,2})\$([A-Za-z0-9+/]+={0,2})$/.exec(
      stored,
    );
  if (!match) {
    return {
      error:
        "The password is not a stored hash. Run the password migration first.",
    };
  }
  const rounds = Number(match[1]);
  if (!Number.isInteger(rounds) || rounds < 1 || rounds > 120000) {
    return { error: "The password hash uses an unsupported round count." };
  }
  if (Buffer.from(match[2], "base64").length === 0) {
    return { error: "The password salt is empty." };
  }
  if (Buffer.from(match[3], "base64").length === 0) {
    return { error: "The password hash is empty." };
  }
  return { rounds, salt: match[2], hash: match[3] };
}

function whatsapp(value) {
  const text = cell(value);
  if (!text) return { value: "" };
  const digits = text.replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 15) {
    return { error: "Enter a WhatsApp number." };
  }
  return { value: `+${digits}` };
}

function companions(value, self, stay) {
  const codes = cell(value)
    .split(",")
    .map((code) => code.trim())
    .filter(Boolean);
  if (codes.length > 12) return { error: "List at most 12 companions." };
  const seen = new Set();
  for (const code of codes) {
    if (code === self) return { error: "A camper cannot list themself." };
    if (seen.has(code)) return { error: "List each companion once." };
    if (code.length >= 80) return { error: `${code} is too long.` };
    seen.add(code);
  }
  if (codes.length > 0 && !["4", "5", "6"].includes(stay)) {
    return { error: "Companions require a tent." };
  }
  return { codes };
}

function purchase(data) {
  const purchased = cell(data.purchased).toLowerCase();
  let size = cell(data.purchased_size);
  let at = cell(data.purchased_at);
  if (purchased !== "" && purchased !== "yes") {
    return { error: "Mark the tipi purchase as yes or leave it blank." };
  }
  if (purchased !== "yes") {
    if (size || at) {
      return { error: "Tick the purchase, or clear the tent and the date." };
    }
    return { purchased: "", purchased_size: "", purchased_at: "" };
  }
  if (!["tipi2", "star2", "star5", "tipi6"].includes(size)) {
    return { error: "Choose which tent or tipi was bought." };
  }
  if (!at || at.length >= 40)
    return { error: "Enter when the tent was bought." };
  return { purchased: "yes", purchased_size: size, purchased_at: at };
}

function saleAnswer(data) {
  const sale = ["yes", "no"].includes(cell(data.sale_available).toLowerCase())
    ? cell(data.sale_available).toLowerCase()
    : "";
  const kaptain =
    sale === "yes" && cell(data.kaptain).toLowerCase() === "yes" ? "yes" : "";
  if (sale !== "no" || cell(data.needs_ticket).toLowerCase() !== "yes") {
    return {
      sale_available: sale,
      kaptain,
      needs_ticket: "",
      ticket_name: "",
      ticket_email: "",
      ticket_birth: "",
      ticket_gender: "",
      ticket_nationality: "",
      ticket_residency: "",
    };
  }
  const ticketName = cell(data.ticket_name);
  const ticketEmail = normalizeEmail(data.ticket_email);
  const birth = cell(data.ticket_birth);
  const gender = cell(data.ticket_gender).toLowerCase();
  const nationality = cell(data.ticket_nationality);
  const residency = cell(data.ticket_residency);
  if (!ticketName || ticketName.length >= 200)
    return { error: "Enter the ticket name." };
  if (!isEmail(ticketEmail)) return { error: "Enter the ticket email." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birth))
    return { error: "Enter the date of birth." };
  if (!["male", "female", "other"].includes(gender)) {
    return { error: "Choose male, female, or other." };
  }
  if (!nationality || nationality.length >= 100)
    return { error: "Enter a nationality." };
  if (!residency || residency.length >= 100)
    return { error: "Enter a residency." };
  return {
    sale_available: sale,
    kaptain,
    needs_ticket: "yes",
    ticket_name: ticketName,
    ticket_email: ticketEmail,
    ticket_birth: birth,
    ticket_gender: gender,
    ticket_nationality: nationality,
    ticket_residency: residency,
  };
}
