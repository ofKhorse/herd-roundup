const assert = require("node:assert/strict");
const test = require("node:test");
const { parseSizes, peopleFromCsv, toCsv } = require("./cli");
const { assignTipis } = require("./tipis");

test("reads a sizes list and a people export", function () {
  assert.deepEqual(parseSizes("5x2,4"), [5, 5, 4]);
  const people = peopleFromCsv(
    'member_code,full_name,stay,share_with\nA,"Ada, A.",tipi5,"B, C"\n',
  );
  assert.equal(people[0].full_name, "Ada, A.");
  assert.deepEqual(people[0].share_with, ["B", "C"]);
  assert.equal(people[0].stay, "tipi5");
});

test("writes one assignment row per person", function () {
  const people = [
    { member_code: "A", full_name: "Ada", stay: "", share_with: ["B"] },
    { member_code: "B", full_name: "Bea", stay: "", share_with: ["A"] },
  ];
  const csv = toCsv(assignTipis(people, [2]), people);
  assert.match(csv, /^member_code,full_name,tipi_id,tipi_size\n/);
  assert.match(csv, /A,Ada,T01,2/);
  assert.match(csv, /B,Bea,T01,2/);
});
