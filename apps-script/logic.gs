function handleAction(body, db, deps) {
  if (!body) {
    return { ok: false, error: "Unknown aktion." };
  }
  if (body.action === "register") {
    return registerPerson_(body, db, deps || {});
  }
  if (body.action === "login") {
    return loginPerson_(body, db, deps || {});
  }
  if (body.action === "reset") {
    return resetPassword_(body, db, deps || {});
  }
  if (body.action === "save") {
    return savePerson_(body, db, deps || {});
  }
  return { ok: false, error: "Unknown aktion." };
}

function registerPerson_(body, db, deps) {
  var email = normalizeEmail_(body.email);
  if (!isEmail_(email)) {
    return { ok: false, error: "Enter a valid email." };
  }
  var whatsapp = normalizeWhatsapp_(body.whatsapp);
  if (!isWhatsapp_(whatsapp)) {
    return { ok: false, error: "Enter a WhatsApp number." };
  }
  var people = db.listPeople();
  if (findByEmail_(people, email)) {
    return { ok: false, error: "That email is already registered." };
  }
  var password = generatePassword_();
  deps.sendPassword(email, password);
  db.insertPerson(
    emptyPerson_(
      email,
      hashPassword_(password),
      nextMemberCode_(people),
      whatsapp,
    ),
  );
  return { ok: true };
}

function emptyPerson_(email, password, memberCode, whatsapp) {
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
    whatsapp: whatsapp || "",
    sale_available: "",
    kaptain: "",
  };
}

function normalizeWhatsapp_(value) {
  return String(value || "").trim();
}

function isWhatsapp_(value) {
  var digits = value.replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 15;
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
  db.updatePerson(person.member_code, { password: hashPassword_(password) });
  return { ok: true };
}

function savePerson_(body, db, deps) {
  var people = db.listPeople();
  var found = authenticatedPerson_(people, body, db, deps);
  if (found.error) {
    return found;
  }
  var person = found.person;
  var whatsapp =
    body.whatsapp === undefined
      ? normalizeWhatsapp_(person.whatsapp)
      : normalizeWhatsapp_(body.whatsapp);
  if (body.whatsapp !== undefined && !isWhatsapp_(whatsapp)) {
    return { ok: false, error: "Enter a WhatsApp number." };
  }
  var stay = body.stay === undefined ? person.stay || "" : String(body.stay);
  if (stay !== "" && !isPreference_(stay)) {
    return { ok: false, error: preferenceError_() };
  }
  var shareWith =
    body.share_with === undefined ? person.share_with || [] : body.share_with;
  if (!Array.isArray(shareWith)) {
    return { ok: false, error: "List kompanions as member kodes." };
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
  if (shareWith.length > 0 && !isTent_(stay)) {
    return {
      ok: false,
      error:
        stay === "arrange"
          ? "You kan add people only when you choose a tent or a tipi."
          : "Choose a sleeping preference before adding people.",
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
  var saleAvailable =
    body.sale_available === undefined
      ? person.sale_available || ""
      : body.sale_available === "yes"
        ? "yes"
        : "";
  var kaptain = saleAvailable === "yes" && body.kaptain === "yes" ? "yes" : "";
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
    whatsapp: whatsapp,
    sale_available: saleAvailable,
    kaptain: kaptain,
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

function loginPerson_(body, db, deps) {
  var people = db.listPeople();
  if (body.token) {
    var fromToken = personFromToken_(people, body.token, deps);
    if (fromToken.error) {
      return fromToken;
    }
    var tokenView = sessionView_(fromToken.person, people);
    var refreshed = signToken_(fromToken.person, deps);
    if (refreshed.error) {
      return refreshed;
    }
    tokenView.token = refreshed.token;
    return tokenView;
  }
  var found = authenticatedPerson_(people, body, db, deps);
  if (found.error) {
    return found;
  }
  var freshPeople = db.listPeople();
  var fresh = findByEmail_(freshPeople, normalizeEmail_(body.email));
  var view = sessionView_(fresh, freshPeople);
  if (deps.sessionSecret) {
    var issued = signToken_(fresh, deps);
    if (issued.error) {
      return issued;
    }
    view.token = issued.token;
  }
  return view;
}

function authenticatedPerson_(people, body, db, deps) {
  if (body.token) {
    return personFromToken_(people, body.token, deps || {});
  }
  var email = normalizeEmail_(body.email);
  var person = findByEmail_(people, email);
  if (!person) {
    return { ok: false, error: "That email is not registered." };
  }
  var password = String(body.password || "");
  if (!passwordMatches_(person.password, password)) {
    return { ok: false, error: "Wrong password." };
  }
  if (!isHashedPassword_(person.password)) {
    db.updatePerson(person.member_code, { password: hashPassword_(password) });
  }
  return { person: person };
}

function sessionView_(person, people) {
  var stayKeys = ["2", "4", "5", "6", "arrange", ""];
  var stayCounts = {};
  stayKeys.forEach(function (k) {
    stayCounts[k] = 0;
  });
  people.forEach(function (other) {
    var s = other.stay || "";
    if (stayCounts[s] !== undefined) {
      stayCounts[s] += 1;
    }
  });
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
    signup_count: isAdmin_(person) ? people.length : null,
    stay_counts: isAdmin_(person) ? stayCounts : null,
  };
}

function feeOwed_(stay) {
  if (stay === "arrange") {
    return 50;
  }
  if (stay === "2" || stay === "4" || stay === "5" || stay === "6") {
    return 365;
  }
  return null;
}

function isTent_(stay) {
  return stay === "2" || stay === "4" || stay === "5" || stay === "6";
}

function isPreference_(stay) {
  return isTent_(stay) || stay === "arrange";
}

function isPurchase_(size) {
  return (
    size === "tipi2" || size === "star2" || size === "star5" || size === "tipi6"
  );
}

function preferenceError_() {
  return "Choose 2, 4, 5, or 6 people, or I arrange myself.";
}

function purchaseError_() {
  return "Choose Tipi, up to 2 people, Star Tent, up to 2 people, Star Tent, up to 5 people, or Tipi, up to 6 people.";
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
      whatsapp: normalizeWhatsapp_(other.whatsapp),
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
    whatsapp: normalizeWhatsapp_(person.whatsapp),
    sale_available: person.sale_available || "",
    kaptain: person.kaptain || "",
    fee_owed: feeOwed_(person.stay || ""),
  };
}

function personFromToken_(people, token, deps) {
  var claims = verifyToken_(token, deps);
  if (claims.error) {
    return claims;
  }
  var person = findByEmail_(people, claims.email);
  if (
    !person ||
    passwordStamp_(person.password, deps.sessionSecret) !== claims.stamp
  ) {
    return { ok: false, error: "Log in again." };
  }
  return { person: person };
}

function signToken_(person, deps) {
  var now = sessionUnix_(deps);
  if (!deps.sessionSecret || now === null) {
    return { ok: false, error: "Log in again." };
  }
  var header = base64UrlEncodeText_('{"alg":"HS256","typ":"JWT"}');
  var payload = base64UrlEncodeText_(
    JSON.stringify({
      email: normalizeEmail_(person.email),
      stamp: passwordStamp_(person.password, deps.sessionSecret),
      exp: now + 2592000,
    }),
  );
  var signing = header + "." + payload;
  var signature = base64UrlEncode_(
    hmacSha256_(utf8Bytes_(deps.sessionSecret), utf8Bytes_(signing)),
  );
  return { token: signing + "." + signature };
}

function verifyToken_(token, deps) {
  var parts = String(token || "").split(".");
  if (parts.length !== 3 || !deps || !deps.sessionSecret) {
    return { ok: false, error: "Log in again." };
  }
  var signing = parts[0] + "." + parts[1];
  var expected = hmacSha256_(
    utf8Bytes_(deps.sessionSecret),
    utf8Bytes_(signing),
  );
  var actual = base64UrlDecode_(parts[2]);
  if (!actual || !constantTimeEqual_(expected, actual)) {
    return { ok: false, error: "Log in again." };
  }
  var payload = base64UrlDecode_(parts[1]);
  if (!payload) {
    return { ok: false, error: "Log in again." };
  }
  var claims;
  try {
    claims = JSON.parse(utf8Text_(payload));
  } catch (error) {
    return { ok: false, error: "Log in again." };
  }
  var now = sessionUnix_(deps);
  if (
    !claims ||
    !claims.email ||
    !claims.stamp ||
    !claims.exp ||
    now === null ||
    Number(claims.exp) < now
  ) {
    return { ok: false, error: "Log in again." };
  }
  return {
    email: normalizeEmail_(claims.email),
    stamp: String(claims.stamp),
  };
}

function passwordStamp_(stored, secret) {
  return base64UrlEncode_(
    hmacSha256_(utf8Bytes_(String(secret)), utf8Bytes_(String(stored))).slice(
      0,
      12,
    ),
  );
}

function sessionUnix_(deps) {
  var raw =
    deps && typeof deps.now === "function"
      ? deps.now()
      : new Date().toISOString();
  var parsed = Date.parse(raw);
  if (parsed !== parsed) {
    return null;
  }
  return Math.floor(parsed / 1000);
}

function base64UrlEncodeText_(text) {
  return base64UrlEncode_(utf8Bytes_(text));
}

function base64UrlEncode_(bytes) {
  return base64Encode_(bytes)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64UrlDecode_(text) {
  var padded = String(text || "")
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  while (padded.length % 4 !== 0) {
    padded += "=";
  }
  return base64Decode_(padded);
}

function utf8Text_(bytes) {
  var text = "";
  for (var i = 0; i < bytes.length; i++) {
    text += String.fromCharCode(bytes[i]);
  }
  return text;
}

function generatePassword_() {
  var alphabet = "abcdefghijkmnopqrstuvwxyz23456789";
  var password = "";
  for (var i = 0; i < 8; i++) {
    password += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
  }
  return password;
}

var PASSWORD_ITERATIONS_ = 10000;
var PASSWORD_ITERATION_LIMIT_ = 200000;
var BASE64_ALPHABET_ =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
var SHA256_K_ = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
  0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
  0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
  0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
  0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
  0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

function hashPassword_(password, saltBytes) {
  var salt = saltBytes || randomBytes_(16);
  var hash = pbkdf2Sha256_(
    utf8Bytes_(String(password)),
    salt,
    PASSWORD_ITERATIONS_,
    32,
  );
  return (
    "pbkdf2_sha256$" +
    PASSWORD_ITERATIONS_ +
    "$" +
    base64Encode_(salt) +
    "$" +
    base64Encode_(hash)
  );
}

function isHashedPassword_(stored) {
  return String(stored || "").indexOf("pbkdf2_sha256$") === 0;
}

function passwordMatches_(stored, password) {
  var saved = String(stored || "");
  var attempt = String(password || "");
  if (!isHashedPassword_(saved)) {
    return saved === attempt;
  }
  var parts = saved.split("$");
  if (parts.length !== 4) {
    return false;
  }
  var iterations = Number(parts[1]);
  if (
    !iterations ||
    iterations < 1 ||
    iterations > PASSWORD_ITERATION_LIMIT_ ||
    Math.floor(iterations) !== iterations
  ) {
    return false;
  }
  var salt = base64Decode_(parts[2]);
  var expected = base64Decode_(parts[3]);
  if (!salt || !expected || salt.length === 0 || expected.length === 0) {
    return false;
  }
  var actual = pbkdf2Sha256_(
    utf8Bytes_(attempt),
    salt,
    iterations,
    expected.length,
  );
  return constantTimeEqual_(actual, expected);
}

function hashPlainPasswords_(cells) {
  return cells.map(function (row) {
    var current = String(row[0]);
    if (current === "" || isHashedPassword_(current)) {
      return [current];
    }
    return [hashPassword_(current)];
  });
}

function randomBytes_(length) {
  var bytes = [];
  for (var i = 0; i < length; i++) {
    bytes.push(Math.floor(Math.random() * 256));
  }
  return bytes;
}

function utf8Bytes_(text) {
  var bytes = [];
  for (var i = 0; i < text.length; i++) {
    var code = text.charCodeAt(i);
    if (code < 0x80) {
      bytes.push(code);
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code >= 0xd800 && code <= 0xdbff && i + 1 < text.length) {
      var next = text.charCodeAt(++i);
      var point = 0x10000 + ((code - 0xd800) << 10) + (next - 0xdc00);
      bytes.push(
        0xf0 | (point >> 18),
        0x80 | ((point >> 12) & 0x3f),
        0x80 | ((point >> 6) & 0x3f),
        0x80 | (point & 0x3f),
      );
    } else {
      bytes.push(
        0xe0 | (code >> 12),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f),
      );
    }
  }
  return bytes;
}

function pbkdf2Sha256_(password, salt, iterations, length) {
  var blockCount = Math.ceil(length / 32);
  var derived = [];
  for (var block = 1; block <= blockCount; block++) {
    var u = hmacSha256_(
      password,
      salt.concat([
        (block >>> 24) & 255,
        (block >>> 16) & 255,
        (block >>> 8) & 255,
        block & 255,
      ]),
    );
    var t = u.slice();
    for (var round = 1; round < iterations; round++) {
      u = hmacSha256_(password, u);
      for (var byte = 0; byte < t.length; byte++) {
        t[byte] ^= u[byte];
      }
    }
    derived = derived.concat(t);
  }
  return derived.slice(0, length);
}

function hmacSha256_(key, message) {
  var block = 64;
  var normalized = key.slice();
  if (normalized.length > block) {
    normalized = sha256Bytes_(normalized);
  }
  while (normalized.length < block) {
    normalized.push(0);
  }
  var inner = [];
  var outer = [];
  for (var i = 0; i < block; i++) {
    inner.push(normalized[i] ^ 0x36);
    outer.push(normalized[i] ^ 0x5c);
  }
  return sha256Bytes_(outer.concat(sha256Bytes_(inner.concat(message))));
}

function sha256Bytes_(bytes) {
  var state = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c,
    0x1f83d9ab, 0x5be0cd19,
  ];
  var bitLength = bytes.length * 8;
  var padded = bytes.slice();
  padded.push(0x80);
  while (padded.length % 64 !== 56) {
    padded.push(0);
  }
  var high = Math.floor(bitLength / 0x100000000);
  var low = bitLength >>> 0;
  for (var shift = 24; shift >= 0; shift -= 8) {
    padded.push((high >>> shift) & 255);
  }
  for (var lowShift = 24; lowShift >= 0; lowShift -= 8) {
    padded.push((low >>> lowShift) & 255);
  }
  var words = new Array(64);
  for (var offset = 0; offset < padded.length; offset += 64) {
    for (var i = 0; i < 16; i++) {
      var index = offset + i * 4;
      words[i] =
        ((padded[index] << 24) |
          (padded[index + 1] << 16) |
          (padded[index + 2] << 8) |
          padded[index + 3]) >>>
        0;
    }
    for (var word = 16; word < 64; word++) {
      var s0 =
        ((words[word - 15] >>> 7) | (words[word - 15] << 25)) ^
        ((words[word - 15] >>> 18) | (words[word - 15] << 14)) ^
        (words[word - 15] >>> 3);
      var s1 =
        ((words[word - 2] >>> 17) | (words[word - 2] << 15)) ^
        ((words[word - 2] >>> 19) | (words[word - 2] << 13)) ^
        (words[word - 2] >>> 10);
      words[word] = (words[word - 16] + s0 + words[word - 7] + s1) >>> 0;
    }
    var a = state[0];
    var b = state[1];
    var c = state[2];
    var d = state[3];
    var e = state[4];
    var f = state[5];
    var g = state[6];
    var h = state[7];
    for (var round = 0; round < 64; round++) {
      var capitalS1 =
        ((e >>> 6) | (e << 26)) ^
        ((e >>> 11) | (e << 21)) ^
        ((e >>> 25) | (e << 7));
      var choose = (e & f) ^ (~e & g);
      var temp1 =
        (h + capitalS1 + choose + SHA256_K_[round] + words[round]) >>> 0;
      var capitalS0 =
        ((a >>> 2) | (a << 30)) ^
        ((a >>> 13) | (a << 19)) ^
        ((a >>> 22) | (a << 10));
      var majority = (a & b) ^ (a & c) ^ (b & c);
      var temp2 = (capitalS0 + majority) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }
    state[0] = (state[0] + a) >>> 0;
    state[1] = (state[1] + b) >>> 0;
    state[2] = (state[2] + c) >>> 0;
    state[3] = (state[3] + d) >>> 0;
    state[4] = (state[4] + e) >>> 0;
    state[5] = (state[5] + f) >>> 0;
    state[6] = (state[6] + g) >>> 0;
    state[7] = (state[7] + h) >>> 0;
  }
  var out = [];
  for (var part = 0; part < 8; part++) {
    out.push(
      (state[part] >>> 24) & 255,
      (state[part] >>> 16) & 255,
      (state[part] >>> 8) & 255,
      state[part] & 255,
    );
  }
  return out;
}

function base64Encode_(bytes) {
  var out = "";
  for (var i = 0; i < bytes.length; i += 3) {
    var first = bytes[i];
    var second = i + 1 < bytes.length ? bytes[i + 1] : 0;
    var third = i + 2 < bytes.length ? bytes[i + 2] : 0;
    var triple = (first << 16) | (second << 8) | third;
    out += BASE64_ALPHABET_.charAt((triple >> 18) & 63);
    out += BASE64_ALPHABET_.charAt((triple >> 12) & 63);
    out +=
      i + 1 < bytes.length ? BASE64_ALPHABET_.charAt((triple >> 6) & 63) : "=";
    out += i + 2 < bytes.length ? BASE64_ALPHABET_.charAt(triple & 63) : "=";
  }
  return out;
}

function base64Decode_(text) {
  if (text.length % 4 !== 0) {
    return null;
  }
  var out = [];
  for (var i = 0; i < text.length; i += 4) {
    var c0 = BASE64_ALPHABET_.indexOf(text.charAt(i));
    var c1 = BASE64_ALPHABET_.indexOf(text.charAt(i + 1));
    var pad2 = text.charAt(i + 2) === "=";
    var pad3 = text.charAt(i + 3) === "=";
    var c2 = pad2 ? 0 : BASE64_ALPHABET_.indexOf(text.charAt(i + 2));
    var c3 = pad3 ? 0 : BASE64_ALPHABET_.indexOf(text.charAt(i + 3));
    if (c0 < 0 || c1 < 0 || c2 < 0 || c3 < 0) {
      return null;
    }
    out.push((c0 << 2) | (c1 >> 4));
    if (!pad2) {
      out.push(((c1 & 15) << 4) | (c2 >> 2));
    }
    if (!pad3) {
      out.push(((c2 & 3) << 6) | c3);
    }
  }
  return out;
}

function constantTimeEqual_(left, right) {
  if (left.length !== right.length) {
    return false;
  }
  var diff = 0;
  for (var i = 0; i < left.length; i++) {
    diff |= left[i] ^ right[i];
  }
  return diff === 0;
}
