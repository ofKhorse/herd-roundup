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

test("login returns the camper without the password", function () {
  const db = memoryDb();
  const registered = context.handleAction(
    { action: "register", email: "a@x.test" },
    db,
  );
  const result = context.handleAction(
    { action: "login", email: "a@x.test", password: registered.password },
    db,
  );
  assert.equal(result.ok, true);
  assert.equal(result.person.member_code, "KH-001");
  assert.equal(result.person.password, undefined);
  assert.equal(result.tipi_count, 0);
  assert.equal(result.payments.length, 0);
});

test("login rejects an unknown email and a wrong password", function () {
  const db = memoryDb();
  const registered = context.handleAction(
    { action: "register", email: "a@x.test" },
    db,
  );
  const unknown = context.handleAction(
    { action: "login", email: "missing@x.test", password: "whatever" },
    db,
  );
  const wrong = context.handleAction(
    { action: "login", email: "a@x.test", password: registered.password + "x" },
    db,
  );
  assert.equal(unknown.error, "That email is not registered.");
  assert.equal(wrong.error, "Wrong password.");
});

test("reset emails a new password", function () {
  const db = memoryDb();
  const registered = context.handleAction(
    { action: "register", email: "a@x.test" },
    db,
  );
  const sent = [];
  const result = context.handleAction(
    { action: "reset", email: "a@x.test" },
    db,
    {
      sendPassword: function (email, password) {
        sent.push([email, password]);
      },
    },
  );
  assert.equal(result.ok, true);
  assert.equal(result.password, undefined);
  assert.equal(sent.length, 1);
  assert.equal(sent[0][0], "a@x.test");
  assert.equal(db.listPeople()[0].password, sent[0][1]);
  assert.notEqual(db.listPeople()[0].password, registered.password);
});

test("reset reports an unknown email", function () {
  const result = context.handleAction(
    { action: "reset", email: "missing@x.test" },
    memoryDb(),
    {
      sendPassword: function () {
        throw new Error("should not send");
      },
    },
  );
  assert.equal(result.ok, false);
  assert.equal(result.error, "That email is not registered.");
});

test("save stores an ordered companion list and a tipi purchase", function () {
  const db = memoryDb();
  const owner = context.handleAction(
    { action: "register", email: "a@x.test" },
    db,
  );
  context.handleAction({ action: "register", email: "b@x.test" }, db);
  context.handleAction({ action: "register", email: "c@x.test" }, db);
  context.handleAction({ action: "register", email: "d@x.test" }, db);
  context.handleAction({ action: "register", email: "e@x.test" }, db);
  const result = context.handleAction(
    {
      action: "save",
      email: "a@x.test",
      password: owner.password,
      full_name: "Aurel",
      stay: "tipi4",
      share_with: ["KH-002", "KH-003", "KH-004", "KH-005"],
      purchased: "yes",
      purchased_size: "4",
      boomer_id: "B-9",
    },
    db,
    {
      now: function () {
        return "2026-09-25T00:00:00.000Z";
      },
    },
  );
  assert.equal(result.ok, true);
  assert.equal(result.person.full_name, "Aurel");
  assert.equal(result.person.share_with.length, 4);
  assert.equal(result.person.share_with[0], "KH-002");
  assert.equal(result.person.purchased_at, "2026-09-25T00:00:00.000Z");
  assert.equal(result.tipi_count, 1);
  const again = context.handleAction(
    {
      action: "save",
      email: "a@x.test",
      password: owner.password,
      full_name: "Aurel",
      stay: "tipi4",
      purchased: "yes",
      purchased_size: "4",
    },
    db,
    {
      now: function () {
        return "2026-10-01T00:00:00.000Z";
      },
    },
  );
  assert.equal(again.person.purchased_at, "2026-09-25T00:00:00.000Z");
});

test("save rejects companions who do not fit the rules", function () {
  const db = memoryDb();
  const owner = context.handleAction(
    { action: "register", email: "a@x.test" },
    db,
  );
  context.handleAction({ action: "register", email: "b@x.test" }, db);
  const van = context.handleAction(
    {
      action: "save",
      email: "a@x.test",
      password: owner.password,
      stay: "van",
      share_with: ["KH-002"],
    },
    db,
    {},
  );
  const self = context.handleAction(
    {
      action: "save",
      email: "a@x.test",
      password: owner.password,
      stay: "tipi5",
      share_with: ["KH-001"],
    },
    db,
    {},
  );
  const missing = context.handleAction(
    {
      action: "save",
      email: "a@x.test",
      password: owner.password,
      stay: "tipi5",
      share_with: ["KH-999"],
    },
    db,
    {},
  );
  const size = context.handleAction(
    {
      action: "save",
      email: "a@x.test",
      password: owner.password,
      purchased: "yes",
      purchased_size: "9",
    },
    db,
    {
      now: function () {
        return "now";
      },
    },
  );
  assert.equal(van.error, "Choose a tipi before adding people.");
  assert.equal(self.error, "You can't list yourself.");
  assert.equal(missing.error, "That member code is not registered.");
  assert.equal(size.error, "Choose a tipi size of 2, 4, or 5.");
});
