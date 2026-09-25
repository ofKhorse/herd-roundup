function handleAction(body, db) {
  if (!body || body.action !== "register") {
    return { ok: false, error: "Unknown action." };
  }
  return registerPerson_(body, db);
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

function generatePassword_() {
  var alphabet = "abcdefghijkmnopqrstuvwxyz23456789";
  var password = "";
  for (var i = 0; i < 8; i++) {
    password += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
  }
  return password;
}
