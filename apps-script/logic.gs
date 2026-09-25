function handleAction(body, db) {
  if (!body) {
    return { ok: false, error: "Unknown action." };
  }
  if (body.action === "register") {
    return registerPerson_(body, db);
  }
  if (body.action === "login") {
    return loginPerson_(body, db);
  }
  return { ok: false, error: "Unknown action." };
}

function registerPerson_(body, db) {
  var email = normalizeEmail_(body.email);
  if (!isEmail_(email)) {
    return { ok: false, error: "Enter a valid email." };
  }
  var people = db.listPeople();
  if (findByEmail_(people, email)) {
    return { ok: false, error: "That email is already registered." };
  }
  var password = generatePassword_();
  db.insertPerson(emptyPerson_(email, password, nextMemberCode_(people)));
  return { ok: true, password: password };
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
    payments: [],
  };
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
