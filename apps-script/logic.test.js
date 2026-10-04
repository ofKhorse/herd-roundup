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
  Date: Date,
  JSON: JSON,
};
vm.createContext(context);
vm.runInContext(
  fs.readFileSync(path.join(__dirname, "logic.gs"), "utf8"),
  context,
);

function register(db, email) {
  let password;
  const result = context.handleAction(
    { action: "register", email: email, whatsapp: "+41 79 000 00 00" },
    db,
    {
      sendPassword: function (_to, value) {
        password = value;
      },
    },
  );
  return { ok: result.ok, error: result.error, password: password };
}

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

test("register emails a password and does not return it", function () {
  const db = memoryDb();
  const sent = [];
  const result = context.handleAction(
    { action: "register", email: " A@x.test ", whatsapp: "+41 79 000 00 00" },
    db,
    {
      sendPassword: function (email, password) {
        sent.push([email, password]);
      },
    },
  );
  assert.equal(result.ok, true);
  assert.equal(result.password, undefined);
  assert.equal(result.member_code, undefined);
  assert.equal(sent.length, 1);
  assert.equal(sent[0][0], "a@x.test");
  assert.equal(sent[0][1].length, 8);
  const people = db.listPeople();
  assert.equal(people.length, 1);
  assert.equal(people[0].email, "a@x.test");
  assert.equal(people[0].member_code, "KH-001");
  assert.equal(people[0].whatsapp, "+41 79 000 00 00");
  assert.notEqual(people[0].password, sent[0][1]);
  assert.equal(context.passwordMatches_(people[0].password, sent[0][1]), true);
  assert.equal(people[0].full_name, "");
});

test("register keeps the sheet unchanged when the email fails", function () {
  const db = memoryDb();
  assert.throws(function () {
    context.handleAction(
      { action: "register", email: "a@x.test", whatsapp: "+41 79 000 00 00" },
      db,
      {
        sendPassword: function () {
          throw new Error("Could not send the password email.");
        },
      },
    );
  }, /Could not send the password email/);
  assert.equal(db.listPeople().length, 0);
});

test("register assigns the next member code", function () {
  const db = memoryDb([
    { member_code: "KH-004", email: "a@x.test", share_with: [] },
  ]);
  const result = register(db, "b@x.test");
  assert.equal(result.ok, true);
  assert.equal(db.listPeople()[1].member_code, "KH-005");
});

test("register rejects a duplicate email", function () {
  const db = memoryDb([
    { member_code: "KH-001", email: "a@x.test", share_with: [] },
  ]);
  const result = context.handleAction(
    { action: "register", email: "A@x.test", whatsapp: "+41 79 000 00 00" },
    db,
  );
  assert.equal(result.ok, false);
  assert.equal(result.error, "That email is already registered.");
});

test("a sheet number regains its country code plus", function () {
  assert.equal(context.restoreWhatsapp_(41791234567), "+41791234567");
  assert.equal(
    context.restoreWhatsapp_("'+41 79 000 00 00"),
    "+41 79 000 00 00",
  );
  assert.equal(
    context.restoreWhatsapp_("+41 79 000 00 00"),
    "+41 79 000 00 00",
  );
  assert.equal(context.restoreWhatsapp_("123"), "123");
  assert.equal(context.sheetWhatsapp_("+41 79 000 00 00"), "'+41 79 000 00 00");
  assert.equal(context.sheetWhatsapp_(41791234567), "'+41791234567");
});

test("register requires a WhatsApp number", function () {
  const db = memoryDb();
  const result = context.handleAction(
    { action: "register", email: "a@x.test", whatsapp: "123" },
    db,
    {
      sendPassword: function () {
        throw new Error("should not email");
      },
    },
  );
  assert.equal(result.ok, false);
  assert.equal(
    result.error,
    "Start the WhatsApp number with a country kode, such as +41 or +49.",
  );
  const missing = context.handleAction(
    { action: "register", email: "b@x.test", whatsapp: "" },
    db,
    {
      sendPassword: function () {
        throw new Error("should not email");
      },
    },
  );
  assert.equal(missing.error, "Enter a WhatsApp number.");
  const local = context.handleAction(
    { action: "register", email: "c@x.test", whatsapp: "41791234567" },
    db,
    {
      sendPassword: function () {
        throw new Error("should not email");
      },
    },
  );
  assert.equal(
    local.error,
    "Start the WhatsApp number with a country kode, such as +41 or +49.",
  );
  assert.equal(db.listPeople().length, 0);
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
  const registered = register(db, "a@x.test");
  const result = context.handleAction(
    { action: "login", email: "a@x.test", password: registered.password },
    db,
  );
  assert.equal(result.ok, true);
  assert.equal(result.person.member_code, "KH-001");
  assert.equal(result.person.password, undefined);
  assert.equal(result.tipi_count, 0);
  assert.equal(result.tipi_by_size, null);
  assert.equal(result.payments.length, 0);
});

test("login rejects an unknown email and a wrong password", function () {
  const db = memoryDb();
  const registered = register(db, "a@x.test");
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
  const registered = register(db, "a@x.test");
  const previous = db.listPeople()[0].password;
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
  assert.notEqual(db.listPeople()[0].password, previous);
  assert.equal(
    context.passwordMatches_(db.listPeople()[0].password, sent[0][1]),
    true,
  );
  assert.equal(context.passwordMatches_(previous, registered.password), true);
  assert.equal(context.passwordMatches_(previous, sent[0][1]), false);
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
  const owner = register(db, "a@x.test");
  register(db, "b@x.test");
  register(db, "c@x.test");
  register(db, "d@x.test");
  register(db, "e@x.test");
  const result = context.handleAction(
    {
      action: "save",
      email: "a@x.test",
      password: owner.password,
      full_name: "Aurel",
      stay: "6",
      share_with: ["KH-002", "KH-003", "KH-004", "KH-005"],
      purchased: "yes",
      purchased_size: "tipi6",
      boomer_id: "B-9",
      whatsapp: "+41 79 111 22 33",
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
  assert.equal(result.person.whatsapp, "+41 79 111 22 33");
  assert.equal(result.tipi_count, 1);
  const again = context.handleAction(
    {
      action: "save",
      email: "a@x.test",
      password: owner.password,
      full_name: "Aurel",
      stay: "6",
      purchased: "yes",
      purchased_size: "tipi6",
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
  const owner = register(db, "a@x.test");
  register(db, "b@x.test");
  const van = context.handleAction(
    {
      action: "save",
      email: "a@x.test",
      password: owner.password,
      stay: "",
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
      stay: "5",
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
      stay: "5",
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
      purchased_size: "4",
    },
    db,
    {
      now: function () {
        return "now";
      },
    },
  );
  const arrange = context.handleAction(
    {
      action: "save",
      email: "a@x.test",
      password: owner.password,
      stay: "arrange",
      share_with: ["KH-002"],
    },
    db,
    {},
  );
  const alone = context.handleAction(
    {
      action: "save",
      email: "a@x.test",
      password: owner.password,
      stay: "arrange",
      share_with: [],
    },
    db,
    {
      now: function () {
        return "now";
      },
    },
  );
  assert.equal(van.error, "Choose a sleeping preference before adding people.");
  assert.equal(
    arrange.error,
    "You kan add people only when you choose a tent or a tipi.",
  );
  assert.equal(alone.ok, true);
  assert.equal(alone.person.stay, "arrange");
  assert.equal(self.error, "You kan't list yourself.");
  assert.equal(missing.ok, true);
  assert.equal(
    size.error,
    "Choose Tipi, up to 2 people, Star Tent, up to 2 people, Star Tent, up to 5 people, or Tipi, up to 6 people.",
  );
});

test("save rejects a tipi choice without the purchase tick", function () {
  const db = memoryDb();
  const owner = register(db, "a@x.test");
  const unticked = context.handleAction(
    {
      action: "save",
      email: "a@x.test",
      password: owner.password,
      purchased: "",
      purchased_size: "star5",
    },
    db,
    {
      now: function () {
        return "now";
      },
    },
  );
  const noSize = context.handleAction(
    {
      action: "save",
      email: "a@x.test",
      password: owner.password,
      purchased: "yes",
      purchased_size: "",
    },
    db,
    {
      now: function () {
        return "now";
      },
    },
  );
  const stored = db.listPeople()[0];
  assert.equal(unticked.ok, false);
  assert.equal(unticked.field, "purchased");
  assert.equal(
    unticked.error,
    "Tick I bought one, or clear which tent or tipi you chose.",
  );
  assert.equal(noSize.ok, false);
  assert.equal(noSize.field, "purchased_size");
  assert.equal(noSize.error, "Choose which tent or tipi you bought.");
  assert.equal(stored.purchased || "", "");
  assert.equal(stored.purchased_size || "", "");
});

test("admins receive every member row", function () {
  const db = memoryDb();
  const owner = register(db, "a@x.test");
  register(db, "b@x.test");
  db.updatePerson("KH-001", {
    admin: "yes",
    purchased: "yes",
    purchased_size: "tipi6",
  });
  db.updatePerson("KH-002", {
    full_name: "Bea",
    camp_fee_paid: "yes",
    amount: "65",
    payment_ref: "KH-002",
    purchased: "yes",
    purchased_size: "star5",
    boomer_id: "B-2",
    stay: "5",
    sale_available: "yes",
    kaptain: "yes",
    share_with: ["KH-001"],
  });
  const result = context.handleAction(
    { action: "login", email: "a@x.test", password: owner.password },
    db,
  );
  assert.equal(result.tipi_by_size.tipi2, 0);
  assert.equal(result.tipi_by_size.star2, 0);
  assert.equal(result.tipi_by_size.star5, 1);
  assert.equal(result.tipi_by_size.tipi6, 1);
  const member = result.payments[1];
  assert.equal(result.payments.length, 2);
  assert.equal(member.full_name, "Bea");
  assert.equal(member.email, "b@x.test");
  assert.equal(member.camp_fee_paid, "yes");
  assert.equal(member.amount, "65");
  assert.equal(member.whatsapp, "+41 79 000 00 00");
  assert.equal(member.boomer_id, "B-2");
  assert.equal(member.stay, "5");
  assert.equal(member.sale_available, "yes");
  assert.equal(member.kaptain, "yes");
  assert.equal(member.purchased, "yes");
  assert.equal(member.purchased_size, "star5");
  assert.deepEqual(member.share_with, ["KH-001"]);
  assert.equal(result.payments[0].password, undefined);
});

test("a stored plaintext password is hashed on the next login", function () {
  const db = memoryDb([
    {
      member_code: "KH-001",
      email: "a@x.test",
      password: "secret12",
      share_with: [],
    },
  ]);
  const result = context.handleAction(
    { action: "login", email: "a@x.test", password: "secret12" },
    db,
  );
  assert.equal(result.ok, true);
  const stored = db.listPeople()[0].password;
  assert.equal(context.isHashedPassword_(stored), true);
  assert.equal(context.passwordMatches_(stored, "secret12"), true);
  const again = context.handleAction(
    { action: "login", email: "a@x.test", password: "secret12" },
    db,
  );
  assert.equal(again.ok, true);
  assert.equal(db.listPeople()[0].password, stored);
});

test("password hashes are salted PBKDF2-SHA256", function () {
  const first = context.hashPassword_("samepass");
  const second = context.hashPassword_("samepass");
  assert.notEqual(first, second);
  assert.equal(context.passwordMatches_(first, "samepass"), true);
  assert.equal(context.passwordMatches_(first, "other"), false);
  assert.equal(context.passwordMatches_("pbkdf2_sha256$nope", "x"), false);
  const hash = context.pbkdf2Sha256_(
    context.utf8Bytes_("password"),
    context.utf8Bytes_("salt"),
    4096,
    32,
  );
  assert.equal(
    hash.map((byte) => byte.toString(16).padStart(2, "0")).join(""),
    "c5e478d59288c841aa530db6845c4c8d962893a001ce4e11a4963873aa98134a",
  );
  const cells = context.hashPlainPasswords_([["secret12"], [""], [first]]);
  assert.equal(context.passwordMatches_(cells[0][0], "secret12"), true);
  assert.equal(cells[1][0], "");
  assert.equal(cells[2][0], first);
});

test("a session token signs in without the password", function () {
  const db = memoryDb();
  const registered = register(db, "a@x.test");
  const deps = {
    sessionSecret: "test-secret",
    now: function () {
      return "2026-09-30T12:00:00.000Z";
    },
  };
  const login = context.handleAction(
    { action: "login", email: "a@x.test", password: registered.password },
    db,
    deps,
  );
  assert.equal(login.ok, true);
  assert.equal(login.token.split(".").length, 3);
  assert.equal(login.token.indexOf(registered.password), -1);
  const again = context.handleAction(
    { action: "login", token: login.token },
    db,
    deps,
  );
  assert.equal(again.ok, true);
  assert.equal(again.person.password, undefined);
  const saved = context.handleAction(
    {
      action: "save",
      token: again.token,
      full_name: "Aurel",
      stay: "arrange",
    },
    db,
    deps,
  );
  assert.equal(saved.ok, true);
  assert.equal(saved.person.full_name, "Aurel");
  const expired = context.handleAction(
    { action: "login", token: login.token },
    db,
    {
      sessionSecret: "test-secret",
      now: function () {
        return "2026-11-01T12:00:00.000Z";
      },
    },
  );
  assert.equal(expired.error, "Log in again.");
  let nextPassword;
  context.handleAction({ action: "reset", email: "a@x.test" }, db, {
    sendPassword: function (_email, password) {
      nextPassword = password;
    },
  });
  const stale = context.handleAction(
    { action: "login", token: again.token },
    db,
    deps,
  );
  assert.equal(stale.error, "Log in again.");
  const fresh = context.handleAction(
    { action: "login", email: "a@x.test", password: nextPassword },
    db,
    deps,
  );
  assert.equal(fresh.ok, true);
  const tampered =
    login.token.slice(0, -1) + (login.token.slice(-1) === "a" ? "b" : "a");
  const bad = context.handleAction(
    { action: "login", token: tampered },
    db,
    deps,
  );
  assert.equal(bad.error, "Log in again.");
});
