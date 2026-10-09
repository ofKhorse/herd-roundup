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

function db(uid, email) {
  return testEnv.authenticatedContext(uid, { email: email }).firestore();
}

test("a camper can change their name", async function () {
  await reset(1);
  const ada = db("ada", "ada@x.test");
  await assertSucceeds(setDoc(doc(ada, "people/ada"), person()));
  await assertSucceeds(updateDoc(doc(ada, "people/ada"), { full_name: "Ada" }));
});

test("a camper claims the next kode and cannot pick another", async function () {
  await reset(1);
  const ada = db("ada", "ada@x.test");
  await assertSucceeds(setDoc(doc(ada, "people/ada"), person()));
  await assertSucceeds(updateDoc(doc(ada, "counters/member"), { next: 2 }));
  await assertFails(
    setDoc(doc(ada, "people/ada-other"), person({ email: "ada@x.test" })),
  );
});

test("a camper cannot change the kode, admin, or amount", async function () {
  await reset(4);
  const ada = db("ada", "ada@x.test");
  await assertSucceeds(
    setDoc(doc(ada, "people/ada"), person({ member_code: "KH-004" })),
  );
  await assertFails(
    updateDoc(doc(ada, "people/ada"), { member_code: "KH-999" }),
  );
  await assertFails(updateDoc(doc(ada, "people/ada"), { admin: true }));
  await assertFails(updateDoc(doc(ada, "people/ada"), { amount: "55" }));
});

test("companions require a tent and cannot include yourself", async function () {
  await reset(1);
  const ada = db("ada", "ada@x.test");
  await assertSucceeds(setDoc(doc(ada, "people/ada"), person()));
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
  const ada = db("ada", "ada@x.test");
  await assertSucceeds(setDoc(doc(ada, "people/ada"), person()));
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
  const ada = db("ada", "ada@x.test");
  await assertSucceeds(
    setDoc(doc(ada, "people/ada"), person({ full_name: "Ada Lovelace" })),
  );
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
  const ada = db("ada", "ada@x.test");
  await assertSucceeds(setDoc(doc(ada, "people/ada"), person()));
  const admin = db("admin", "admin@x.test");
  await assertSucceeds(getDoc(doc(admin, "people/ada")));
});

test("a new camper takes the next kode and then writes the directory", async function () {
  await reset(45);
  const ada = db("ada", "ada@x.test");
  const personRef = doc(ada, "people/ada");
  const counterRef = doc(ada, "counters/member");
  await assertSucceeds(
    runTransaction(ada, async function (tx) {
      const existing = await tx.get(personRef);
      assert.equal(existing.exists(), false);
      const counter = await tx.get(counterRef);
      const number = counter.data().next;
      tx.set(
        personRef,
        person({
          member_code: "KH-0" + number,
          email: "ada@x.test",
          full_name: "",
          stay: "",
          share_with: [],
          whatsapp: "+41791234567",
        }),
      );
      tx.update(counterRef, { next: number + 1 });
    }),
  );
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
  });
});
