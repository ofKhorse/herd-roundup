import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test, after } from "node:test";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  doc,
  getDoc,
  runTransaction,
  setDoc,
  updateDoc,
} from "firebase/firestore";

const testEnv = await initializeTestEnvironment({
  projectId: "demo-herd-rules",
  firestore: {
    rules: readFileSync(new URL("../firestore.rules", import.meta.url), "utf8"),
  },
});

after(async function () {
  await testEnv.cleanup();
});

function person(overrides) {
  return Object.assign(
    {
      member_code: "KH-001",
      email: "ada@x.test",
      admin: false,
      full_name: "Ada Lovelace",
      stay: "5",
      purchased: "",
      purchased_size: "",
      purchased_at: "",
      boomer_email: "",
      share_with: [],
      camp_fee_paid: "",
      amount: "",
      payment_ref: "",
      whatsapp: "+41790000000",
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

async function reset(next) {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async function (context) {
    await setDoc(doc(context.firestore(), "counters/member"), { next: next });
  });
}

function code(number) {
  return number < 10
    ? "KH-00" + number
    : number < 100
      ? "KH-0" + number
      : "KH-" + number;
}

function db(uid, email) {
  return testEnv
    .authenticatedContext(uid, { email: email, email_verified: true })
    .firestore();
}

async function claim(uid, email) {
  const firestore = db(uid, email);
  const counterRef = doc(firestore, "counters/member");
  let number = 0;
  await assertSucceeds(
    runTransaction(firestore, async function (tx) {
      const counter = await tx.get(counterRef);
      const claims = Object.assign({}, counter.data().claims || {});
      if (typeof claims[uid] === "number") {
        number = claims[uid];
        return;
      }
      number = counter.data().next;
      claims[uid] = number;
      tx.update(counterRef, { next: number + 1, claims: claims });
    }),
  );
  return number;
}

async function signUp(uid, email, overrides) {
  const number = await claim(uid, email);
  const data = person(
    Object.assign(
      {
        member_code: code(number),
        email: email,
      },
      overrides,
    ),
  );
  await assertSucceeds(setDoc(doc(db(uid, email), "people/" + uid), data));
  return data;
}

test("a camper can change their name", async function () {
  await reset(1);
  await signUp("ada", "ada@x.test");
  const ada = db("ada", "ada@x.test");
  await assertSucceeds(updateDoc(doc(ada, "people/ada"), { full_name: "Ada" }));
});

test("a camper claims one kode and cannot take another", async function () {
  await reset(1);
  await signUp("ada", "ada@x.test");
  const ada = db("ada", "ada@x.test");
  await assertFails(updateDoc(doc(ada, "counters/member"), { next: 3 }));
  await assertFails(
    updateDoc(doc(ada, "counters/member"), {
      next: 3,
      claims: { ada: 2 },
    }),
  );
  await assertFails(
    setDoc(doc(ada, "people/ada-other"), person({ email: "ada@x.test" })),
  );
});

test("a camper cannot change the kode, admin, or amount", async function () {
  await reset(4);
  await signUp("ada", "ada@x.test");
  const ada = db("ada", "ada@x.test");
  await assertFails(
    updateDoc(doc(ada, "people/ada"), { member_code: "KH-999" }),
  );
  await assertFails(updateDoc(doc(ada, "people/ada"), { admin: true }));
  await assertFails(updateDoc(doc(ada, "people/ada"), { amount: "55" }));
});

test("companions require a tent and cannot include yourself", async function () {
  await reset(1);
  await signUp("ada", "ada@x.test");
  const ada = db("ada", "ada@x.test");
  await assertFails(
    updateDoc(doc(ada, "people/ada"), {
      stay: "arrange",
      share_with: ["KH-002"],
    }),
  );
  await assertFails(
    updateDoc(doc(ada, "people/ada"), { share_with: ["KH-001"] }),
  );
  await assertSucceeds(
    updateDoc(doc(ada, "people/ada"), {
      share_with: ["Ada Lovelace"],
      whatsapp: "",
    }),
  );
});

test("a ticket request stores the details only when the sale answer is no", async function () {
  await reset(1);
  await signUp("ada", "ada@x.test");
  const ada = db("ada", "ada@x.test");
  await assertFails(
    updateDoc(doc(ada, "people/ada"), {
      sale_available: "yes",
      needs_ticket: "yes",
      ticket_name: "Ada",
    }),
  );
  await assertFails(
    updateDoc(doc(ada, "people/ada"), {
      sale_available: "no",
      needs_ticket: "yes",
      ticket_name: "Ada",
    }),
  );
  await assertSucceeds(
    updateDoc(doc(ada, "people/ada"), {
      sale_available: "no",
      kaptain: "",
      needs_ticket: "yes",
      ticket_name: "Ada Lovelace",
      ticket_email: "ada@boom.test",
      ticket_birth: "1990-04-05",
      ticket_gender: "female",
      ticket_nationality: "Swiss",
      ticket_residency: "Portugal",
    }),
  );
});

test("another camper reads the directory and not the profile", async function () {
  await reset(1);
  await signUp("ada", "ada@x.test", { full_name: "Ada Lovelace" });
  const ada = db("ada", "ada@x.test");
  await assertSucceeds(
    setDoc(doc(ada, "directory/ada"), {
      member_code: "KH-001",
      full_name: "Ada Lovelace",
      email: "",
      share_with: [],
    }),
  );
  const bea = db("bea", "bea@x.test");
  await assertSucceeds(getDoc(doc(bea, "directory/ada")));
  await assertFails(getDoc(doc(bea, "people/ada")));
  await assertFails(
    setDoc(doc(bea, "directory/ada"), {
      member_code: "KH-001",
      full_name: "Ada Lovelace",
      email: "ada@x.test",
      share_with: [],
    }),
  );
});

test("an admin records a payment and a camper cannot", async function () {
  await reset(1);
  await signUp("ada", "ada@x.test");
  await testEnv.withSecurityRulesDisabled(async function (context) {
    await setDoc(
      doc(context.firestore(), "people/admin"),
      person({
        email: "admin@x.test",
        admin: true,
        member_code: "KH-000",
      }),
    );
  });
  const admin = db("admin", "admin@x.test");
  const ada = db("ada", "ada@x.test");
  await assertSucceeds(
    updateDoc(doc(admin, "people/ada"), {
      amount: "365.00",
      camp_fee_paid: "yes",
    }),
  );
  await assertFails(
    updateDoc(doc(admin, "people/ada"), { full_name: "Changed" }),
  );
  await assertFails(updateDoc(doc(ada, "people/ada"), { amount: "1.00" }));
  const payment = {
    contributor: "Alba Reyes",
    payment_count: 1,
    total: "365.00",
    last_payment: "08.10.2026 20:21",
    sheet_kode: "KH-037",
    override_kode: "",
  };
  await assertSucceeds(setDoc(doc(admin, "payments/alba-reyes"), payment));
  await assertSucceeds(
    updateDoc(doc(admin, "payments/alba-reyes"), { override_kode: "KH-014" }),
  );
  await assertFails(getDoc(doc(ada, "payments/alba-reyes")));
  await assertFails(setDoc(doc(ada, "payments/alba-reyes"), payment));
});

test("an admin reads another camper", async function () {
  await reset(1);
  await testEnv.withSecurityRulesDisabled(async function (context) {
    await setDoc(
      doc(context.firestore(), "people/admin"),
      person({
        email: "admin@x.test",
        admin: true,
        member_code: "KH-000",
      }),
    );
  });
  await signUp("ada", "ada@x.test");
  const admin = db("admin", "admin@x.test");
  await assertSucceeds(getDoc(doc(admin, "people/ada")));
});

test("a new camper takes the next kode and then writes the directory", async function () {
  await reset(45);
  const created = await signUp("ada", "ada@x.test", {
    full_name: "",
    stay: "",
    share_with: [],
    whatsapp: "+41791234567",
  });
  assert.equal(created.member_code, "KH-045");
  const ada = db("ada", "ada@x.test");
  await assertSucceeds(
    setDoc(doc(ada, "directory/ada"), {
      member_code: "KH-045",
      full_name: "",
      email: "ada@x.test",
      share_with: [],
    }),
  );
  await testEnv.withSecurityRulesDisabled(async function (context) {
    const snap = await getDoc(doc(context.firestore(), "counters/member"));
    assert.equal(snap.data().next, 46);
    assert.equal(snap.data().claims.ada, 45);
  });
});

test("two campers cannot take the same kode", async function () {
  await reset(5);
  const adaNumber = await claim("ada", "ada@x.test");
  const beaNumber = await claim("bea", "bea@x.test");
  assert.notEqual(adaNumber, beaNumber);
  await assertSucceeds(
    setDoc(
      doc(db("ada", "ada@x.test"), "people/ada"),
      person({ member_code: code(adaNumber), email: "ada@x.test" }),
    ),
  );
  await assertFails(
    setDoc(
      doc(db("bea", "bea@x.test"), "people/bea"),
      person({ member_code: code(adaNumber), email: "bea@x.test" }),
    ),
  );
  await assertSucceeds(
    setDoc(
      doc(db("bea", "bea@x.test"), "people/bea"),
      person({ member_code: code(beaNumber), email: "bea@x.test" }),
    ),
  );
});

test("a registration without a kode is visible to an admin", async function () {
  await reset(1);
  await testEnv.withSecurityRulesDisabled(async function (context) {
    await setDoc(
      doc(context.firestore(), "people/admin"),
      person({
        email: "admin@x.test",
        admin: true,
        member_code: "KH-000",
      }),
    );
  });
  const guest = testEnv
    .authenticatedContext("bea", {
      email: "bea@x.test",
      email_verified: false,
    })
    .firestore();
  await assertSucceeds(
    setDoc(doc(guest, "signups/bea"), { email: "bea@x.test" }),
  );
  await assertFails(
    setDoc(doc(guest, "signups/bea"), { email: "other@x.test" }),
  );
  await assertFails(getDoc(doc(guest, "signups/ada")));
  const admin = db("admin", "admin@x.test");
  await assertSucceeds(getDoc(doc(admin, "signups/bea")));
  const ada = db("ada", "ada@x.test");
  await assertFails(getDoc(doc(ada, "signups/bea")));
});

test("an unconfirmed email cannot read or write camp data", async function () {
  await reset(1);
  await signUp("ada", "ada@x.test");
  const stranger = testEnv
    .authenticatedContext("bea", {
      email: "bea@x.test",
      email_verified: false,
    })
    .firestore();
  await assertFails(getDoc(doc(stranger, "directory/ada")));
  await assertFails(getDoc(doc(stranger, "counters/member")));
  await assertFails(
    setDoc(
      doc(stranger, "people/bea"),
      person({ email: "bea@x.test", member_code: "KH-002" }),
    ),
  );
});
