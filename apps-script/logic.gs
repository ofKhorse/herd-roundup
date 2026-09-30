function handleAction(body, db, deps) {
  if (!body) {
    return { ok: false, error: "Unknown action." };
  }
  if (body.action === "register") {
    return registerPerson_(body, db, deps || {});
  }
  if (body.action === "login") {
    return loginPerson_(body, db);
  }
  if (body.action === "reset") {
    return resetPassword_(body, db, deps || {});
  }
  if (body.action === "save") {
    return savePerson_(body, db, deps || {});
  }
  return { ok: false, error: "Unknown action." };
}

function registerPerson_(body, db, deps) {
  var email = normalizeEmail_(body.email);
  if (!isEmail_(email)) {
    return { ok: false, error: "Enter a valid email." };
  }
  var people = db.listPeople();
  if (findByEmail_(people, email)) {
    return { ok: false, error: "That email is already registered." };
  }
  var password = generatePassword_();
  deps.sendPassword(email, password);
  db.insertPerson(emptyPerson_(email, password, nextMemberCode_(people)));
  return { ok: true };
}

function emptyPerson_(email, password, memberCode) {
  return {
    member_code: memberCode,
    email: email,
    password: password,
    full_name: "",
    admin: "",
    stay: "",
    purchased: "",
    purchased_size: "",
    purchased_at: "",
    boomer_id: "",
    share_with: [],
    camp_fee_paid: "",
    amount: "",
    payment_ref: "",
  };
}

function normalizeEmail_(email) {
  return String(email || "")
    .trim()
    .toLowerCase();
}

function isEmail_(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function findByEmail_(people, email) {
  for (var i = 0; i < people.length; i++) {
    if (normalizeEmail_(people[i].email) === email) {
      return people[i];
    }
  }
  return null;
}

function nextMemberCode_(people) {
  var max = 0;
  for (var i = 0; i < people.length; i++) {
    var match = /^KH-(\d+)$/.exec(people[i].member_code || "");
    if (match) {
      max = Math.max(max, Number(match[1]));
    }
  }
  var number = String(max + 1);
  while (number.length < 3) {
    number = "0" + number;
  }
  return "KH-" + number;
}

function resetPassword_(body, db, deps) {
  var email = normalizeEmail_(body.email);
  var person = findByEmail_(db.listPeople(), email);
  if (!person) {
    return { ok: false, error: "That email is not registered." };
  }
  var password = generatePassword_();
  deps.sendPassword(email, password);
  db.updatePerson(person.member_code, { password: password });
  return { ok: true };
}

function savePerson_(body, db, deps) {
  var people = db.listPeople();
  var found = authenticatedPerson_(people, body);
  if (found.error) {
    return found;
  }
  var person = found.person;
  var stay = body.stay === undefined ? person.stay || "" : String(body.stay);
  if (stay !== "" && !isPreference_(stay)) {
    return { ok: false, error: preferenceError_() };
  }
  var shareWith =
    body.share_with === undefined ? person.share_with || [] : body.share_with;
  if (!Array.isArray(shareWith)) {
    return { ok: false, error: "List companions as member codes." };
  }
  var seen = {};
  for (var i = 0; i < shareWith.length; i++) {
    var code = String(shareWith[i]);
    if (code === person.member_code) {
      return { ok: false, error: "You kan't list yourself." };
    }
    if (seen[code]) {
      return { ok: false, error: "List each person once." };
    }
    seen[code] = true;
    if (!findByCode_(people, code)) {
      return { ok: false, error: "That member kode is not registered." };
    }
  }
  if (shareWith.length > 0 && !isPreference_(stay)) {
    return {
      ok: false,
      error: "Khoose a sleeping preference before adding people.",
    };
  }
  var purchased =
    body.purchased === undefined
      ? person.purchased || ""
      : String(body.purchased);
  if (purchased !== "" && purchased !== "yes") {
    return {
      ok: false,
      error: "Mark the tipi purchase as yes or leave it blank.",
    };
  }
  var size =
    body.purchased_size === undefined
      ? person.purchased_size || ""
      : String(body.purchased_size);
  if (purchased === "yes" && !isPurchase_(size)) {
    return { ok: false, error: purchaseError_() };
  }
  if (purchased !== "yes") {
    size = "";
  }
  var purchasedAt = person.purchased_at || "";
  if (purchased === "yes" && person.purchased !== "yes") {
    purchasedAt = deps.now();
  }
  if (purchased !== "yes") {
    purchasedAt = "";
  }
  db.updatePerson(person.member_code, {
    full_name:
      body.full_name === undefined
        ? person.full_name || ""
        : String(body.full_name).trim(),
    stay: stay,
    share_with: shareWith,
    purchased: purchased,
    purchased_size: size,
    purchased_at: purchasedAt,
    boomer_id:
      body.boomer_id === undefined
        ? person.boomer_id || ""
        : String(body.boomer_id).trim(),
  });
  var updatedPeople = db.listPeople();
  return sessionView_(
    findByCode_(updatedPeople, person.member_code),
    updatedPeople,
  );
}

function findByCode_(people, code) {
  for (var i = 0; i < people.length; i++) {
    if (people[i].member_code === code) {
      return people[i];
    }
  }
  return null;
}

function loginPerson_(body, db) {
  var people = db.listPeople();
  var found = authenticatedPerson_(people, body);
  if (found.error) {
    return found;
  }
  return sessionView_(found.person, people);
}

function authenticatedPerson_(people, body) {
  var email = normalizeEmail_(body.email);
  var person = findByEmail_(people, email);
  if (!person) {
    return { ok: false, error: "That email is not registered." };
  }
  if (String(person.password) !== String(body.password || "")) {
    return { ok: false, error: "Wrong password." };
  }
  return { person: person };
}

function sessionView_(person, people) {
  return {
    ok: true,
    person: publicPerson_(person),
    directory: people
      .filter(function (other) {
        return other.member_code !== person.member_code;
      })
      .map(function (other) {
        return {
          member_code: other.member_code,
          full_name: other.full_name || "",
          share_with: other.share_with || [],
        };
      }),
    tipi_count: people.filter(function (other) {
      return other.purchased === "yes";
    }).length,
    tipi_by_size: isAdmin_(person) ? tipiBySize_(people) : null,
    payments: isAdmin_(person) ? paymentRows_(people) : [],
  };
}

function isPreference_(stay) {
  return stay === "2" || stay === "4" || stay === "5" || stay === "6";
}

function isPurchase_(size) {
  return (
    size === "tipi2" || size === "star2" || size === "star5" || size === "tipi6"
  );
}

function preferenceError_() {
  return "Khoose a sleeping preference of 2, 4, 5, or 6 people.";
}

function purchaseError_() {
  return "Khoose Tipi, up to 2 people, Star Tent, up to 2 people, Star Tent, up to 5 people, or Tipi, up to 6 people.";
}

function tipiBySize_(people) {
  var counts = { tipi2: 0, star2: 0, star5: 0, tipi6: 0 };
  people.forEach(function (person) {
    if (person.purchased !== "yes") {
      return;
    }
    var size = String(person.purchased_size);
    if (isPurchase_(size)) {
      counts[size] += 1;
    }
  });
  return counts;
}

function isAdmin_(person) {
  return String(person.admin || "").toLowerCase() === "yes";
}

function paymentRows_(people) {
  return people.map(function (other) {
    return {
      member_code: other.member_code,
      full_name: other.full_name || "",
      email: normalizeEmail_(other.email),
      amount: other.amount || "",
      payment_ref: other.payment_ref || "",
      camp_fee_paid: other.camp_fee_paid || "",
    };
  });
}

function publicPerson_(person) {
  return {
    member_code: person.member_code,
    email: normalizeEmail_(person.email),
    full_name: person.full_name || "",
    admin: person.admin || "",
    stay: person.stay || "",
    purchased: person.purchased || "",
    purchased_size: person.purchased_size || "",
    purchased_at: person.purchased_at || "",
    boomer_id: person.boomer_id || "",
    share_with: person.share_with || [],
    camp_fee_paid: person.camp_fee_paid || "",
    amount: person.amount || "",
    payment_ref: person.payment_ref || "",
  };
}

function generatePassword_() {
  var alphabet = "abcdefghijkmnopqrstuvwxyz23456789";
  var password = "";
  for (var i = 0; i < 8; i++) {
    password += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
  }
  return password;
}
