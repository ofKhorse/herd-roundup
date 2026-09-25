const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const context = {
  Math: Math,
  Number: Number,
  String: String,
  RegExp: RegExp,
};
vm.createContext(context);
vm.runInContext(
  fs.readFileSync(path.join(__dirname, "logic.gs"), "utf8"),
  context,
);

function memoryDb(seed) {
  const people = (seed || []).map(function (person) {
    return Object.assign({}, person, {
      share_with: (person.share_with || []).slice(),
    });
  });
  return {
    listPeople: function () {
      return people.map(function (person) {
        return Object.assign({}, person, {
          share_with: person.share_with.slice(),
        });
      });
    },
    insertPerson: function (person) {
      people.push(
        Object.assign({}, person, {
          share_with: (person.share_with || []).slice(),
        }),
      );
    },
    updatePerson: function (memberCode, fields) {
      const person = people.filter(function (row) {
        return row.member_code === memberCode;
      })[0];
      Object.keys(fields).forEach(function (key) {
        person[key] = fields[key];
      });
    },
  };
}

test("register stores a camper and returns a password", function () {
  const db = memoryDb();
  const result = context.handleAction(
    { action: "register", email: " A@x.test " },
    db,
  );
  assert.equal(result.ok, true);
  assert.equal(typeof result.password, "string");
  assert.equal(result.password.length, 8);
  assert.equal(result.member_code, undefined);
  const people = db.listPeople();
  assert.equal(people.length, 1);
  assert.equal(people[0].email, "a@x.test");
  assert.equal(people[0].member_code, "KH-001");
  assert.equal(people[0].password, result.password);
  assert.equal(people[0].full_name, "");
});

test("register assigns the next member code", function () {
  const db = memoryDb([
    { member_code: "KH-004", email: "a@x.test", share_with: [] },
  ]);
  const result = context.handleAction(
    { action: "register", email: "b@x.test" },
    db,
  );
  assert.equal(result.ok, true);
  assert.equal(db.listPeople()[1].member_code, "KH-005");
});

test("register rejects a duplicate email", function () {
  const db = memoryDb([
    { member_code: "KH-001", email: "a@x.test", share_with: [] },
  ]);
  const result = context.handleAction(
    { action: "register", email: "A@x.test" },
    db,
  );
  assert.equal(result.ok, false);
  assert.equal(result.error, "That email is already registered.");
});

test("register rejects an invalid email", function () {
  const db = memoryDb();
  const result = context.handleAction(
    { action: "register", email: "not-an-email" },
    db,
  );
  assert.equal(result.ok, false);
  assert.equal(result.error, "Enter a valid email.");
  assert.equal(db.listPeople().length, 0);
});
