const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const context = { String: String, RegExp: RegExp };
vm.createContext(context);
vm.runInContext(
  fs.readFileSync(path.join(__dirname, "profile-write.js"), "utf8"),
  context,
);

function draft(overrides) {
  return Object.assign(
    {
      full_name: "Ada Lovelace",
      stay: "5",
      boomer_email: "ada@boom.test",
      purchased: "",
      purchased_size: "",
      whatsapp: "+41791234567",
      share_with: ["KH-002"],
      sale_available: "",
      kaptain: "",
      needs_ticket: "",
      ticket_name: "",
      ticket_email: "",
      ticket_birth: "",
      ticket_gender: "",
      ticket_nationality: "",
      ticket_residency: "",
    },
    overrides,
  );
}

test("member kodes stay three digits until 100", function () {
  assert.equal(context.memberCodeFromNumber(1), "KH-001");
  assert.equal(context.memberCodeFromNumber(9), "KH-009");
  assert.equal(context.memberCodeFromNumber(45), "KH-045");
  assert.equal(context.memberCodeFromNumber(100), "KH-100");
});

test("a phone with spaces is stored as a plus and digits", function () {
  assert.equal(context.storedWhatsapp("+41 79 123 45 67"), "+41791234567");
});

test("a named camper hides their email in the directory", function () {
  const entry = context.directoryEntry({
    member_code: "KH-045",
    full_name: "Ada Lovelace",
    email: "ada@x.test",
    share_with: ["KH-002"],
  });
  assert.equal(entry.member_code, "KH-045");
  assert.equal(entry.full_name, "Ada Lovelace");
  assert.equal(entry.email, "");
  assert.equal(entry.share_with[0], "KH-002");
  assert.equal(entry.share_with.length, 1);
});

test("a nameless camper keeps their email in the directory", function () {
  const entry = context.directoryEntry({
    member_code: "KH-045",
    full_name: "",
    email: "ada@x.test",
    share_with: [],
  });
  assert.equal(entry.email, "ada@x.test");
});

test("buying a tent records the time once", function () {
  assert.equal(
    context.purchasedAtFor(
      { purchased: "" },
      "yes",
      "2026-10-09T00:00:00.000Z",
    ),
    "2026-10-09T00:00:00.000Z",
  );
  assert.equal(
    context.purchasedAtFor(
      { purchased: "yes", purchased_at: "2026-01-01T00:00:00.000Z" },
      "yes",
      "2026-10-09T00:00:00.000Z",
    ),
    "2026-01-01T00:00:00.000Z",
  );
  assert.equal(
    context.purchasedAtFor(
      { purchased: "yes", purchased_at: "2026-01-01T00:00:00.000Z" },
      "",
      "2026-10-09T00:00:00.000Z",
    ),
    "",
  );
});

test("a new profile takes the next kode and leaves payments blank", function () {
  const written = context.peopleWrite(draft({ full_name: "" }), {
    member_code: "KH-045",
    email: "ada@x.test",
    admin: false,
    camp_fee_paid: "",
    amount: "",
    payment_ref: "",
    purchased_at: "",
  });
  assert.equal(written.member_code, "KH-045");
  assert.equal(written.email, "ada@x.test");
  assert.equal(written.admin, false);
  assert.equal(written.amount, "");
  assert.equal(written.camp_fee_paid, "");
  assert.equal(written.payment_ref, "");
  assert.equal(written.kaptain, "");
  assert.equal(written.needs_ticket, "");
});

test("an update keeps the kode, admin flag, and recorded amount", function () {
  const written = context.peopleWrite(
    draft({
      full_name: "Ada",
      sale_available: "yes",
      kaptain: "yes",
      needs_ticket: "yes",
      ticket_name: "Ada",
    }),
    {
      member_code: "KH-001",
      email: "ada@x.test",
      admin: true,
      camp_fee_paid: "yes",
      amount: "55",
      payment_ref: "boom",
      purchased_at: "",
    },
  );
  assert.equal(written.member_code, "KH-001");
  assert.equal(written.admin, true);
  assert.equal(written.amount, "55");
  assert.equal(written.camp_fee_paid, "yes");
  assert.equal(written.kaptain, "yes");
  assert.equal(written.needs_ticket, "");
  assert.equal(written.ticket_name, "");
});

test("a draft that the rules would reject is reported on the field", function () {
  const problems = context.draftProblems(
    draft({
      full_name: "A".repeat(200),
      boomer_email: "not-an-email",
      share_with: new Array(13).fill("KH-002"),
      whatsapp: "+41 79",
    }),
  );
  assert.equal(
    problems
      .map(function (problem) {
        return problem.field;
      })
      .join(","),
    "full_name,boomer_email,share_with,whatsapp",
  );
});
