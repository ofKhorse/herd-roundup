import assert from "node:assert/strict";
import { test } from "node:test";
import { recordsFromCsv, uidFor } from "./people-import.mjs";

const HASH = "pbkdf2_sha256$100$c2FsdA==$aGFzaA==";

function csv(rows) {
  const headers = [
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
    "needs_ticket",
    "ticket_name",
    "ticket_email",
    "ticket_birth",
    "ticket_gender",
    "ticket_nationality",
    "ticket_residency",
  ];
  return [headers.join(",")]
    .concat(
      rows.map(function (row) {
        return headers
          .map(function (header) {
            const value = row[header] || "";
            return /[",\n]/.test(value)
              ? `"${value.replaceAll('"', '""')}"`
              : value;
          })
          .join(",");
      }),
    )
    .join("\n");
}

function row(overrides) {
  return Object.assign(
    {
      member_code: "KH-001",
      email: "Ada@X.test",
      password: HASH,
      full_name: "Ada Lovelace",
      admin: "",
      stay: "5",
      whatsapp: "'+41 79 000 00 00",
      sale_available: "",
    },
    overrides,
  );
}

test("a named camper keeps the hash and hides the email in the directory", function () {
  const result = recordsFromCsv(
    csv([row({ admin: "yes", share_with: "KH-002,KH-003" })]),
  );
  assert.deepEqual(result.errors, []);
  assert.equal(result.next, 2);
  const record = result.records[0];
  assert.equal(record.email, "ada@x.test");
  assert.equal(record.uid, uidFor("ada@x.test"));
  assert.equal(record.rounds, 100);
  assert.equal(record.salt, "c2FsdA==");
  assert.equal(record.hash, "aGFzaA==");
  assert.equal(record.person.admin, true);
  assert.equal(record.person.whatsapp, "+41790000000");
  assert.deepEqual(record.person.share_with, ["KH-002", "KH-003"]);
  assert.equal(record.person.password, undefined);
  assert.equal(record.directory.email, "");
  assert.equal(record.directory.full_name, "Ada Lovelace");
});

test("a nameless camper is listed by email and a ticket is kept only for a no", function () {
  const result = recordsFromCsv(
    csv([
      row({
        full_name: "",
        sale_available: "no",
        kaptain: "yes",
        needs_ticket: "yes",
        ticket_name: "Ada Lovelace",
        ticket_email: "Ada@Boom.test",
        ticket_birth: "1990-04-05",
        ticket_gender: "female",
        ticket_nationality: "Swiss",
        ticket_residency: "Portugal",
      }),
      row({
        member_code: "KH-004",
        email: "bea@x.test",
        full_name: "Bea",
        sale_available: "yes",
        kaptain: "yes",
        needs_ticket: "yes",
        ticket_name: "Ignored",
      }),
    ]),
  );
  assert.deepEqual(result.errors, []);
  assert.equal(result.next, 5);
  assert.equal(result.records[0].directory.email, "ada@x.test");
  assert.equal(result.records[0].person.kaptain, "");
  assert.equal(result.records[0].person.needs_ticket, "yes");
  assert.equal(result.records[0].person.ticket_email, "ada@boom.test");
  assert.equal(result.records[1].person.kaptain, "yes");
  assert.equal(result.records[1].person.needs_ticket, "");
  assert.equal(result.records[1].person.ticket_name, "");
});

test("a repeated email and a plain password are rejected", function () {
  const result = recordsFromCsv(
    csv([
      row({ share_with: "Ada Lovelace" }),
      row({ member_code: "KH-003", email: "ada@x.test" }),
      row({ member_code: "KH-004", email: "cy@x.test", password: "secret123" }),
    ]),
  );
  assert.equal(result.records.length, 2);
  assert.deepEqual(result.records[0].person.share_with, ["Ada Lovelace"]);
  assert.match(result.errors[0], /repeats ada@x.test/);
  assert.match(result.errors[1], /stored hash/);
});

test("ticket columns that are not on the sheet yet stay blank", function () {
  const text = csv([row({ sale_available: "yes", kaptain: "yes" })]).replace(
    /,needs_ticket,ticket_name,ticket_email,ticket_birth,ticket_gender,ticket_nationality,ticket_residency/g,
    "",
  );
  const result = recordsFromCsv(text);
  assert.deepEqual(result.errors, []);
  assert.equal(result.records[0].person.needs_ticket, "");
  assert.equal(result.records[0].person.kaptain, "yes");
});

test("a missing column is reported before any camper", function () {
  const result = recordsFromCsv("member_code,email\nKH-001,ada@x.test\n");
  assert.deepEqual(result.records, []);
  assert.match(result.errors.join("\n"), /missing password/);
});
