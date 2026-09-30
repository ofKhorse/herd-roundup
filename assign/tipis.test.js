const assert = require("node:assert/strict");
const test = require("node:test");
const { assignTipis } = require("./tipis");

test("keeps mutual top picks together and skips vans", function () {
  const result = assignTipis(
    [
      { member_code: "A", stay: "tipi4", share_with: ["B", "C"] },
      { member_code: "B", stay: "tipi4", share_with: ["A"] },
      { member_code: "C", stay: "", share_with: ["A"] },
      { member_code: "D", stay: "van", share_with: ["A"] },
    ],
    [3],
  );
  assert.deepEqual(result.tipis[0].members.slice().sort(), ["A", "B", "C"]);
  assert.deepEqual(result.unassigned, []);
  assert.deepEqual(result.conflicts, []);
});

test("does not force a friend cluster bigger than every tipi", function () {
  const people = [];
  for (let i = 1; i <= 6; i++) {
    const shareWith = [];
    if (i > 1) {
      shareWith.push("P" + (i - 1));
    }
    if (i < 6) {
      shareWith.push("P" + (i + 1));
    }
    people.push({
      member_code: "P" + i,
      stay: "",
      share_with: shareWith,
    });
  }
  const result = assignTipis(people, [5]);
  assert.equal(result.conflicts.length, 1);
  assert.equal(result.conflicts[0].length, 6);
  assert.equal(result.tipis[0].members.length, 5);
  assert.equal(result.unassigned.length, 1);
});

test("puts the stronger pair in the only two-person tipi", function () {
  const result = assignTipis(
    [
      { member_code: "A", stay: "", share_with: ["B", "C"] },
      { member_code: "B", stay: "", share_with: ["A"] },
      { member_code: "C", stay: "", share_with: ["A"] },
    ],
    [2],
  );
  assert.deepEqual(result.tipis[0].members.slice().sort(), ["A", "B"]);
  assert.deepEqual(result.unassigned, ["C"]);
});
