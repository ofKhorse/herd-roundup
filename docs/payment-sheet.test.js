const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const context = {
  String: String,
  RegExp: RegExp,
  Number: Number,
  Math: Math,
  isFinite: isFinite,
  parseInt: parseInt,
};
vm.createContext(context);
vm.runInContext(
  fs.readFileSync(path.join(__dirname, "payment-sheet.js"), "utf8"),
  context,
);

function member(overrides) {
  return Object.assign(
    {
      uid: "ada",
      member_code: "KH-037",
      full_name: "Alba Reyes",
      stay: "5",
      amount: "",
      camp_fee_paid: "",
    },
    overrides,
  );
}

test("money text keeps the euro amount", function () {
  assert.equal(context.paymentCents("€365.00"), 36500);
  assert.equal(context.paymentCents("€55.00"), 5500);
  assert.equal(context.paymentCents("€14,259.00"), 1425900);
  assert.equal(context.paymentCents("1,50"), 150);
  assert.equal(context.paymentCents("14,259"), 1425900);
  assert.equal(context.paymentCents(365), 36500);
  assert.equal(context.paymentAmountText(36500), "365.00");
});

test("a kode wins, and the name is only a fallback", function () {
  var alba = member({ uid: "alba" });
  var alex = member({
    uid: "alex",
    member_code: "KH-066",
    full_name: "Alex Keil",
    stay: "arrange",
  });
  var matched = context.paymentMatch(
    { contributor: "Someone Else", sheet_kode: "KH-66", total: "55.00" },
    [alba, alex],
  );
  assert.equal(matched.how, "kode");
  assert.equal(matched.member.uid, "alex");
  var six = member({ uid: "six", member_code: "KH-006", full_name: "Six" });
  var shortKode = context.paymentMatch(
    { contributor: "Someone Else", sheet_kode: "KH-6", total: "55.00" },
    [alba, alex, six],
  );
  assert.equal(shortKode.member.uid, "six");
  var byName = context.paymentMatch(
    { contributor: "Alba Reyes", sheet_kode: "", total: "365.00" },
    [alba, alex],
  );
  assert.equal(byName.how, "name");
  assert.equal(byName.member.uid, "alba");
  var unknownKode = context.paymentMatch(
    { contributor: "Alba Reyes", sheet_kode: "KH-999", total: "365.00" },
    [alba, alex],
  );
  assert.equal(unknownKode.how, "name");
  assert.equal(unknownKode.member.uid, "alba");
});

test("an overwrite replaces the sheet kode and the name", function () {
  var alba = member({ uid: "alba" });
  var alex = member({
    uid: "alex",
    member_code: "KH-066",
    full_name: "Alex Keil",
  });
  var moved = context.paymentMatch(
    {
      contributor: "Alba Reyes",
      sheet_kode: "KH-037",
      override_kode: "KH-066",
      total: "365.00",
    },
    [alba, alex],
  );
  assert.equal(moved.how, "override");
  assert.equal(moved.member.uid, "alex");
  var cleared = context.paymentMatch(
    {
      contributor: "Alba Reyes",
      sheet_kode: "KH-037",
      override_kode: "",
      total: "365.00",
    },
    [alba, alex],
  );
  assert.equal(cleared.how, "kode");
  assert.equal(cleared.member.uid, "alba");
});

test("two names or a blank name stay unassigned", function () {
  var one = member({ uid: "one", full_name: "Sam Lee", member_code: "KH-010" });
  var two = member({ uid: "two", full_name: "Sam Lee", member_code: "KH-011" });
  var ambiguous = context.paymentMatch(
    { contributor: "Sam Lee", sheet_kode: "", total: "55.00" },
    [one, two],
  );
  assert.equal(ambiguous.member, null);
  assert.equal(ambiguous.how, "ambiguous");
  var blank = context.paymentMatch(
    { contributor: "Isabella Reinhart", sheet_kode: "", total: "10.00" },
    [member({ full_name: "", member_code: "KH-012" })],
  );
  assert.equal(blank.member, null);
  var accent = context.paymentMatch(
    { contributor: "Constanze Lulsdorf", sheet_kode: "", total: "110.00" },
    [member({ full_name: "Constanze Lülsdorf", member_code: "KH-059" })],
  );
  assert.equal(accent.how, "name");
  assert.equal(
    context.paymentDocId("Constanze Lülsdorf"),
    "constanze-lulsdorf",
  );
});

test("paid is the sum, and the fee marks the kamp fee", function () {
  var alba = member({ uid: "alba", stay: "5", amount: "", camp_fee_paid: "" });
  var rows = [
    { contributor: "Alba Reyes", sheet_kode: "KH-037", total: "300.00" },
    { contributor: "Alba again", sheet_kode: "KH-037", total: "65.00" },
  ];
  var writes = context.paymentMemberWrites(rows, [alba]);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].amount, "365.00");
  assert.equal(writes[0].camp_fee_paid, "yes");
  var short = context.paymentMemberWrites(
    [{ contributor: "Alex Keil", sheet_kode: "KH-066", total: "€55.00" }],
    [
      member({
        uid: "alex",
        member_code: "KH-066",
        full_name: "Alex Keil",
        stay: "arrange",
      }),
    ],
  );
  assert.equal(short[0].amount, "55.00");
  assert.equal(short[0].camp_fee_paid, "yes");
  var unknown = context.paymentMemberWrites(
    [{ contributor: "No Stay", override_kode: "KH-008", total: "10.00" }],
    [
      member({
        uid: "nope",
        member_code: "KH-008",
        full_name: "",
        stay: "",
        amount: "",
        camp_fee_paid: "yes",
      }),
    ],
  );
  assert.equal(unknown.length, 1);
  assert.equal(unknown[0].amount, "10.00");
  assert.equal(unknown[0].camp_fee_paid, undefined);
});
