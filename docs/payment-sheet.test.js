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

test("shares split the payment and the main match keeps the rest", function () {
  var alba = member({ uid: "alba", stay: "5" });
  var alex = member({
    uid: "alex",
    member_code: "KH-066",
    full_name: "Alex Keil",
    stay: "arrange",
  });
  var byName = member({
    uid: "bea",
    member_code: "KH-014",
    full_name: "Bea Schmitt",
    stay: "arrange",
  });
  var allList = [alba, alex, byName];

  var allocKode = context.paymentAllocate(
    {
      contributor: "Alba Reyes",
      sheet_kode: "KH-037",
      total: "365.00",
      shares: [{ kode: "KH-066", amount: "50.00" }],
    },
    allList,
  );
  assert.equal(allocKode.mainMatch.how, "kode");
  assert.equal(allocKode.mainMatch.member.uid, "alba");
  assert.equal(allocKode.shares.length, 1);
  assert.equal(allocKode.shares[0].kode, "KH-066");
  assert.equal(allocKode.shares[0].cents, 5000);
  assert.equal(allocKode.remainder, 31500);
  assert.equal(allocKode.hasLeftover, false);

  var allocName = context.paymentAllocate(
    {
      contributor: "Bea Schmitt",
      sheet_kode: "",
      total: "55.00",
      shares: [{ kode: "KH-037", amount: "30.00" }],
    },
    allList,
  );
  assert.equal(allocName.mainMatch.how, "name");
  assert.equal(allocName.mainMatch.member.uid, "bea");
  assert.equal(allocName.remainder, 2500);
  assert.equal(allocName.hasLeftover, false);

  var writes = context.paymentMemberWrites(
    [
      {
        contributor: "Alba Reyes",
        sheet_kode: "KH-037",
        total: "365.00",
        shares: [{ kode: "KH-066", amount: "50.00" }],
      },
    ],
    allList,
  );
  var byUid = {};
  writes.forEach(function (w) {
    byUid[w.uid] = w;
  });
  assert.equal(byUid["alba"].amount, "315.00");
  assert.equal(byUid["alba"].camp_fee_paid, "");
  assert.equal(byUid["alex"].amount, "50.00");
  assert.equal(byUid["alex"].camp_fee_paid, "");
});

test("a matched payment auto-assigns only 365 and leaves the rest unassigned", function () {
  var phillipe = member({
    uid: "phil",
    member_code: "KH-076",
    full_name: "Phillipe Wigger",
    stay: "6",
  });
  var row = {
    contributor: "Phillipe Wigger",
    sheet_kode: "KH-076",
    total: "1825.00",
    shares: [],
  };
  var alloc = context.paymentAllocate(row, [phillipe]);
  assert.equal(alloc.kept, 36500);
  assert.equal(alloc.unassigned, 146000);
  assert.equal(alloc.hasLeftover, true);
  var writes = context.paymentMemberWrites([row], [phillipe]);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].amount, "365.00");
  assert.equal(writes[0].camp_fee_paid, "yes");
});

test("partial shares leave the remainder as a leftover when there is no main match", function () {
  var alex = member({
    uid: "alex",
    member_code: "KH-066",
    full_name: "Alex Keil",
  });
  var alloc = context.paymentAllocate(
    {
      contributor: "Nobody Known",
      sheet_kode: "",
      total: "365.00",
      shares: [{ kode: "KH-066", amount: "100.00" }],
    },
    [alex],
  );
  assert.equal(alloc.hasLeftover, true);
  assert.equal(alloc.remainder, 26500);
  assert.equal(alloc.shares[0].cents, 10000);

  var allShares = context.paymentAllocate(
    {
      contributor: "Nobody Known",
      sheet_kode: "",
      total: "100.00",
      shares: [{ kode: "KH-066", amount: "100.00" }],
    },
    [alex],
  );
  assert.equal(allShares.hasLeftover, false);
  assert.equal(allShares.remainder, 0);
});

test("shares that exceed the total do not produce a negative remainder", function () {
  var alba = member({ uid: "alba" });
  var alex = member({ uid: "alex", member_code: "KH-066", full_name: "Alex" });
  var alloc = context.paymentAllocate(
    {
      contributor: "Alba Reyes",
      sheet_kode: "KH-037",
      total: "50.00",
      shares: [{ kode: "KH-066", amount: "200.00" }],
    },
    [alba, alex],
  );
  assert.equal(alloc.remainder, 0);
  assert.equal(alloc.hasLeftover, false);
});

test("duplicate kodes in shares are deduplicated and main kode is skipped", function () {
  var alba = member({ uid: "alba" });
  var alex = member({ uid: "alex", member_code: "KH-066", full_name: "Alex" });
  var alloc = context.paymentAllocate(
    {
      contributor: "Alba Reyes",
      sheet_kode: "KH-037",
      total: "100.00",
      shares: [
        { kode: "KH-066", amount: "20.00" },
        { kode: "KH-066", amount: "30.00" },
        { kode: "KH-037", amount: "10.00" },
      ],
    },
    [alba, alex],
  );
  assert.equal(alloc.shares.length, 1);
  assert.equal(alloc.shares[0].kode, "KH-066");
  assert.equal(alloc.shares[0].cents, 2000);
  assert.equal(alloc.remainder, 8000);
});

test("payment totals separate exact tipis from leftover amounts", function () {
  var stats = context.paymentTableStats([
    { total: "365.00" },
    { total: "365.00" },
    { total: "730.00" },
    { total: "1095.00" },
    { total: "55.00" },
    { total: "55" },
    { total: "110.00" },
    { total: "100.50" },
    { total: "" },
  ]);
  assert.equal(
    stats.totalCents,
    36500 + 36500 + 73000 + 109500 + 5500 + 5500 + 11000 + 10050,
  );
  assert.equal(stats.exact, 2);
  assert.equal(stats.fees, 2);
  assert.equal(stats.bundles, 2);
  assert.equal(stats.bundleTipis, 5);
  assert.equal(stats.remaining.join(","), "110.00,100.50");
});

test("an old override_kode with no shares moves the full total", function () {
  var alba = member({ uid: "alba" });
  var alex = member({ uid: "alex", member_code: "KH-066", full_name: "Alex" });
  var alloc = context.paymentAllocate(
    {
      contributor: "Alba Reyes",
      sheet_kode: "KH-037",
      override_kode: "KH-066",
      total: "365.00",
      shares: [],
    },
    [alba, alex],
  );
  assert.equal(alloc.shares.length, 1);
  assert.equal(alloc.shares[0].kode, "KH-066");
  assert.equal(alloc.shares[0].cents, 36500);
  assert.equal(alloc.remainder, 0);
  assert.equal(alloc.hasLeftover, false);
  var writes = context.paymentMemberWrites(
    [
      {
        contributor: "Alba Reyes",
        sheet_kode: "KH-037",
        override_kode: "KH-066",
        total: "365.00",
        shares: [],
      },
    ],
    [alba, alex],
  );
  var byUid = {};
  writes.forEach(function (w) {
    byUid[w.uid] = w;
  });
  assert.ok(!byUid["alba"], "alba should get 0 euros");
  assert.equal(byUid["alex"].amount, "365.00");
});
