var sessionKey = "herd-roundup-session";
var state = {
  directory: [],
  companions: [],
  memberCode: "",
  email: "",
  admin: false,
  kaptains: [],
  tickets: [],
  bought: [],
};

var notice = document.querySelector("#notice");
var auth = document.querySelector("#auth");
var profile = document.querySelector("#profile");
var serverBusy = false;
var requestBusyCancel = function () {};
var toastTimer = null;
var RETRY_LIMIT = 5;
var RETRY_SECONDS = 8;

document.querySelector("#login-form").addEventListener("submit", onLogin);
document.querySelector("#busy-cancel").addEventListener("click", function () {
  requestBusyCancel();
});
document.querySelector("#busy-ok").addEventListener(
  "click",
  function () {
    var text = document.querySelector("#busy-password-text");
    var email = document.querySelector("#busy-ok").dataset.email;
    if (!text || text.hidden || !text.textContent || !email) {
      return;
    }
    document.querySelector("main").inert = false;
    var loginForm = document.querySelector("#login-form");
    var loginSecret = document.querySelector("#login-secret");
    loginForm.elements.email.value = email;
    loginSecret.type = "password";
    loginSecret.name = "password";
    loginSecret.value = text.textContent;
    notifyLoginField_(loginForm.elements.email);
    notifyLoginField_(loginSecret);
  },
  true,
);
document.querySelector("#register-form").addEventListener("submit", onRegister);
document.querySelector("#reset-form").addEventListener("submit", onReset);
document.querySelector("#profile-form").addEventListener("submit", onSave);
document.querySelector("#logout").addEventListener("click", logout);
document.querySelector("#info").addEventListener("toggle", loadInfo);
var payGuide = document.querySelector("#pay-guide");
var payVideo = document.querySelector("#pay-video");
payGuide.addEventListener("toggle", function () {
  if (!payGuide.open) {
    payVideo.pause();
    return;
  }
  var play = payVideo.play();
  if (play && play.catch) {
    play.catch(function () {});
  }
});
document.querySelector("#admin-logout").addEventListener("click", logout);
document
  .querySelector("#copy-kaptain-phones")
  .addEventListener("click", function (event) {
    copyPhones(state.kaptains, event.currentTarget);
  });
document
  .querySelector("#copy-ticket-phones")
  .addEventListener("click", function (event) {
    copyPhones(state.tickets, event.currentTarget);
  });
document
  .querySelector("#copy-bought-phones")
  .addEventListener("click", function (event) {
    copyPhones(state.bought, event.currentTarget);
  });
window.addEventListener("hashchange", showView);
document.querySelector("#village-select").addEventListener("change", syncStay);
document.querySelector("#size-select").addEventListener("change", syncStay);
document
  .querySelector("#profile-form [name=whatsapp]")
  .addEventListener("input", function () {
    clearFieldError("whatsapp");
  });
document
  .querySelector("#profile-form [name=purchased]")
  .addEventListener("change", function () {
    clearFieldError("purchased");
    clearFieldError("purchased_size");
  });
document
  .querySelector("#profile-form [name=purchased_size]")
  .addEventListener("change", function () {
    clearFieldError("purchased");
    clearFieldError("purchased_size");
  });
document
  .querySelector("[name=sale_available]")
  .addEventListener("change", syncSale);
document
  .querySelector("[name=needs_ticket]")
  .addEventListener("change", function () {
    clearTicketErrors();
    syncTicketForm();
  });
[
  "ticket_name",
  "ticket_email",
  "ticket_nationality",
  "ticket_residency",
].forEach(function (name) {
  document
    .querySelector("[name=" + name + "]")
    .addEventListener("input", function () {
      clearFieldError(name);
    });
});
["ticket_birth", "ticket_gender"].forEach(function (name) {
  document
    .querySelector("[name=" + name + "]")
    .addEventListener("change", function () {
      clearFieldError(name);
    });
});

var companionSearch = document.querySelector("#companion-search");
var matchesOpen = false;
companionSearch.addEventListener("focus", function () {
  matchesOpen = true;
  renderMatches();
});
companionSearch.addEventListener("input", function () {
  syncCompanionAdd();
  renderMatches();
});
document
  .querySelector("#companion-add")
  .addEventListener("click", addTypedCompanion);
companionSearch.addEventListener("blur", function () {
  matchesOpen = false;
  document.querySelector("#companion-matches").innerHTML = "";
});
companionSearch.addEventListener("keydown", function (event) {
  if (event.key !== "Enter") {
    return;
  }
  event.preventDefault();
  var match = document.querySelector("#companion-matches button");
  if (match) {
    match.click();
    return;
  }
  addTypedCompanion();
});

var saved = readSession();
if (useFirebase_()) {
  startFirebase();
} else if (saved && (saved.token || (saved.email && saved.password))) {
  signIn(saved, true);
}

function onLogin(event) {
  event.preventDefault();
  var data = new FormData(event.target);
  if (useFirebase_()) {
    signInWithFirebase(
      data.get("email"),
      fieldSecret(document.querySelector("#login-secret")),
    );
    return;
  }
  signIn({ email: data.get("email"), password: data.get("password") }, false);
}

function signIn(credentials, fromCookie, quiet) {
  var body = { action: "login" };
  if (credentials.token) {
    body.token = credentials.token;
  } else {
    body.email = credentials.email;
    body.password = credentials.password;
  }
  callServer(body, {
    pending: "Signing in…",
    success: fromCookie || quiet ? "" : "Signed in.",
    failed: "Sign-in failed.",
  }).then(function (result) {
    if (!result.ok) {
      if (fromCookie) {
        clearSession();
      }
      return;
    }
    if (result.token) {
      writeSession({ token: result.token });
    } else if (!fromCookie) {
      writeSession({
        email: credentials.email,
        password: credentials.password,
      });
    }
    showSession(result);
  });
}

function onRegister(event) {
  event.preventDefault();
  if (useFirebase_()) {
    registerWithFirebase(event.target);
    return;
  }
  var data = new FormData(event.target);
  var whatsappError = whatsappProblem(data.get("whatsapp"));
  var error = event.target.querySelector(".field-error");
  if (whatsappError) {
    error.hidden = false;
    error.textContent = whatsappError;
    return;
  }
  error.hidden = true;
  error.textContent = "";
  callServer(
    {
      action: "register",
      email: data.get("email"),
      whatsapp: data.get("whatsapp"),
    },
    {
      pending: "Registering…",
      failed: "Registration failed.",
      success: function (result) {
        return {
          message: "Write this password down.",
          email: data.get("email"),
          password: result.password,
          warning: "ONLY SHOWN ONCE",
        };
      },
    },
  ).then(function (result) {
    if (!result.ok || !result.password) {
      return;
    }
    signIn(
      { email: data.get("email"), password: result.password },
      false,
      true,
    );
  });
}

function onReset(event) {
  event.preventDefault();
  var data = new FormData(event.target);
  if (useFirebase_()) {
    resetWithFirebase(data.get("email"));
    return;
  }
  callServer(
    { action: "reset", email: data.get("email") },
    {
      pending: "Sending a new password…",
      success: "A new password was emailed to you.",
      failed: "Could not send a new password.",
    },
  );
}

function onSave(event) {
  event.preventDefault();
  if (useFirebase_()) {
    saveWithFirebase(new FormData(event.target));
    return;
  }
  var credentials = readSession();
  if (!credentials || (!credentials.token && !credentials.password)) {
    say("Log in again.");
    return;
  }
  var data = new FormData(event.target);
  var body = {
    action: "save",
    full_name: data.get("full_name"),
    stay: data.get("stay"),
    boomer_email: data.get("boomer_email"),
    purchased: data.get("purchased") ? "yes" : "",
    purchased_size: data.get("purchased_size"),
    whatsapp: data.get("whatsapp"),
    share_with: state.companions,
    sale_available:
      data.get("sale_available") === "yes" ||
      data.get("sale_available") === "no"
        ? data.get("sale_available")
        : "",
    kaptain: data.get("kaptain") === "yes" ? "yes" : "",
  };
  var ticket = ticketPayload(data);
  Object.keys(ticket).forEach(function (key) {
    body[key] = ticket[key];
  });
  if (credentials.token) {
    body.token = credentials.token;
  } else {
    body.email = credentials.email;
    body.password = credentials.password;
  }
  var problems = profileProblems();
  if (problems.length) {
    showFieldErrors(problems);
    return;
  }
  clearFieldErrors();
  callServer(body, {
    pending: "Saving…",
    success: "Saved.",
    failed: "Saving failed.",
  }).then(function (result) {
    if (!result.ok) {
      if (result.field) {
        showFieldErrors([{ field: result.field, error: result.error }]);
      }
      return;
    }
    showSession(result);
  });
}

function showSession(result) {
  if (!result.ok) {
    say(result.error);
    return;
  }
  clearFieldErrors();
  notice.textContent = "";
  openInfoOnce(result.person.member_code);
  auth.hidden = true;
  state.directory = result.directory;
  state.companions = result.person.share_with.slice();
  state.memberCode = result.person.member_code;
  state.email = result.person.email || "";
  showHello(result.person);
  var hasCode = !!result.person.member_code;
  document.querySelector("#member-code-line").hidden = !hasCode;
  document.querySelector("#member-code-pending").hidden = hasCode;
  if (hasCode) {
    document.querySelector("#member-code").textContent =
      result.person.member_code;
  } else {
    document.querySelector("#info").open = false;
    document.querySelector("#pay-guide").open = false;
  }
  document.querySelector("#fee").textContent =
    result.person.camp_fee_paid === "yes"
      ? "Kamp fee marked paid."
      : "Kamp fee not marked paid yet.";
  var feeOwed = result.person.fee_owed;
  var recorded = Number(result.person.amount) || 0;
  var feeOwedEl = document.querySelector("#fee-owed");
  if (feeOwed != null) {
    feeOwedEl.textContent =
      "You owe " +
      feeOwed +
      " EUR. We recorded " +
      recorded +
      " EUR. As we have to manually import payment records this can be outdated!";
  } else {
    feeOwedEl.textContent = "Choose whether you kamp with us to see your fee.";
  }
  var tipiCount = document.querySelector("#tipi-count");
  if (result.tipi_count == null) {
    tipiCount.hidden = true;
  } else {
    tipiCount.hidden = false;
    tipiCount.textContent = result.tipi_count + " tipis marked as bought.";
  }
  var form = document.querySelector("#profile-form");
  form.full_name.value = result.person.full_name;
  restoreStay(result.person.stay);
  form.boomer_email.value = result.person.boomer_email || result.person.email;
  form.whatsapp.value = showWhatsapp(result.person.whatsapp);
  form.purchased.checked = result.person.purchased === "yes";
  form.purchased_size.value = result.person.purchased_size;
  form.sale_available.value = result.person.sale_available || "";
  form.kaptain.value = result.person.kaptain || "";
  form.needs_ticket.checked = result.person.needs_ticket === "yes";
  form.ticket_name.value = result.person.ticket_name || "";
  form.ticket_email.value = result.person.ticket_email || "";
  form.ticket_birth.value = result.person.ticket_birth || "";
  form.ticket_gender.value = result.person.ticket_gender || "";
  form.ticket_nationality.value = result.person.ticket_nationality || "";
  form.ticket_residency.value = result.person.ticket_residency || "";
  syncSale();
  renderCompanions();
  renderMatches();
  renderPickedBy();
  renderMembers(result);
  showView();
}

function syncSale() {
  var available = document.querySelector("[name=sale_available]").value;
  document.querySelector("#kaptain-row").hidden = available !== "yes";
  if (available !== "yes") {
    document.querySelector("[name=kaptain]").value = "";
  }
  var asking = available === "no";
  document.querySelector("#ticket-row").hidden = !asking;
  if (!asking) {
    document.querySelector("[name=needs_ticket]").checked = false;
  }
  syncTicketForm();
}

function syncTicketForm() {
  var available = document.querySelector("[name=sale_available]").value;
  var needsTicket = document.querySelector("[name=needs_ticket]").checked;
  var show = available === "no" && needsTicket;
  document.querySelector("#ticket-fields").hidden = !show;
  if (!show) {
    return;
  }
  var form = document.querySelector("#profile-form");
  if (!form.ticket_name.value.trim()) {
    form.ticket_name.value = form.full_name.value.trim();
  }
  if (!form.ticket_email.value.trim()) {
    form.ticket_email.value =
      form.boomer_email.value.trim() || state.email || "";
  }
}

function ticketPayload(data) {
  var blank = {
    needs_ticket: "",
    ticket_name: "",
    ticket_email: "",
    ticket_birth: "",
    ticket_gender: "",
    ticket_nationality: "",
    ticket_residency: "",
  };
  if (data.get("sale_available") !== "no" || !data.get("needs_ticket")) {
    return blank;
  }
  blank.needs_ticket = "yes";
  blank.ticket_name = String(data.get("ticket_name") || "").trim();
  blank.ticket_email = String(data.get("ticket_email") || "").trim();
  blank.ticket_birth = String(data.get("ticket_birth") || "").trim();
  blank.ticket_gender = String(data.get("ticket_gender") || "").trim();
  blank.ticket_nationality = String(
    data.get("ticket_nationality") || "",
  ).trim();
  blank.ticket_residency = String(data.get("ticket_residency") || "").trim();
  return blank;
}

function clearTicketErrors() {
  [
    "ticket_name",
    "ticket_email",
    "ticket_birth",
    "ticket_gender",
    "ticket_nationality",
    "ticket_residency",
  ].forEach(clearFieldError);
}

function syncStay() {
  clearFieldError("stay");
  clearFieldError("share_with");
  var village = document.querySelector("#village-select").value;
  var size = document.querySelector("#size-select").value;
  var sizeRow = document.querySelector("#size-row");
  var stayHidden = document.querySelector("#stay-hidden");
  if (village === "arrange") {
    sizeRow.hidden = true;
    stayHidden.value = "arrange";
  } else if (village === "yes") {
    sizeRow.hidden = false;
    stayHidden.value = size;
  } else {
    sizeRow.hidden = true;
    stayHidden.value = "";
  }
}

function restoreStay(stayVal) {
  var stay = String(stayVal || "");
  var village = document.querySelector("#village-select");
  var size = document.querySelector("#size-select");
  var sizeRow = document.querySelector("#size-row");
  var stayHidden = document.querySelector("#stay-hidden");
  if (stay === "arrange") {
    village.value = "arrange";
    sizeRow.hidden = true;
    size.value = "";
  } else if (stay === "4" || stay === "5" || stay === "6") {
    village.value = "yes";
    sizeRow.hidden = false;
    size.value = stay;
  } else {
    village.value = "";
    sizeRow.hidden = true;
    size.value = "";
  }
  stayHidden.value = stay || "";
}

function renderCompanions() {
  clearFieldError("share_with");
  var list = document.querySelector("#companions");
  list.innerHTML = "";
  state.companions.forEach(function (code, index) {
    var item = document.createElement("li");
    item.className = "person";
    var name = document.createElement("span");
    name.textContent = labelFor(code);
    var controls = document.createElement("span");
    controls.appendChild(moveButton("Up", index, -1));
    controls.appendChild(document.createTextNode(" "));
    controls.appendChild(moveButton("Down", index, 1));
    controls.appendChild(document.createTextNode(" "));
    controls.appendChild(removeButton(index));
    item.appendChild(name);
    item.appendChild(controls);
    list.appendChild(item);
  });
}

function renderMatches() {
  var box = document.querySelector("#companion-matches");
  box.innerHTML = "";
  if (!matchesOpen) {
    return;
  }
  var query = companionSearch.value.trim();
  var queryLower = query.toLowerCase();
  var matches = state.directory.filter(function (person) {
    if (state.companions.indexOf(person.member_code) !== -1) {
      return false;
    }
    if (!query) {
      return true;
    }
    var haystack = (
      person.full_name +
      " " +
      person.member_code +
      " " +
      (person.email || "")
    ).toLowerCase();
    return haystack.indexOf(queryLower) !== -1;
  });
  matches.forEach(function (person) {
    var button = document.createElement("button");
    button.type = "button";
    button.textContent = labelFor(person.member_code);
    button.addEventListener("mousedown", function (event) {
      event.preventDefault();
    });
    button.addEventListener("click", function () {
      state.companions.push(person.member_code);
      companionSearch.value = "";
      syncCompanionAdd();
      renderCompanions();
      renderMatches();
    });
    box.appendChild(button);
  });
  if (!matches.length) {
    var empty = document.createElement("p");
    empty.className = "no-match";
    empty.textContent = "No match found";
    box.appendChild(empty);
  }
}

function addTypedCompanion() {
  var query = companionSearch.value.trim();
  if (!query) {
    return;
  }
  companionSearch.value = "";
  syncCompanionAdd();
  if (state.companions.indexOf(query) === -1) {
    state.companions.push(query);
    renderCompanions();
  }
  renderMatches();
}

function syncCompanionAdd() {
  document.querySelector("#companion-add").disabled =
    !companionSearch.value.trim();
}

function renderPickedBy() {
  var box = document.querySelector("#picked-by");
  var names = state.directory
    .filter(function (person) {
      return (person.share_with || []).indexOf(state.memberCode) !== -1;
    })
    .map(function (person) {
      return person.full_name || labelFor(person.member_code);
    });
  box.textContent = names.length ? names.join(", ") : "Nobody yet.";
}

function showView() {
  var onAdmin =
    state.admin &&
    (location.hash === "#admin" || location.hash === "#payments");
  document.querySelector("#nav").hidden = !state.admin;
  profile.hidden = onAdmin || (!state.memberCode && !state.email);
  document.querySelector("#admin").hidden = !onAdmin;
  document.querySelector("#show-camp").removeAttribute("aria-current");
  document.querySelector("#show-admin").removeAttribute("aria-current");
  document
    .querySelector(onAdmin ? "#show-admin" : "#show-camp")
    .setAttribute("aria-current", "page");
}

function renderSignupCounts(signupCount, stayCounts) {
  var box = document.querySelector("#signup-counts");
  box.innerHTML = "";
  var total = document.createElement("p");
  total.textContent = "Total signups: " + signupCount;
  box.appendChild(total);
  [
    ["2", "2 people (Tipi or Star Tent)"],
    ["4", "4 people (5-Star Tent)"],
    ["5", "5 people (5-Star Tent)"],
    ["6", "6 people (Tipi)"],
    ["arrange", "I arrange myself"],
    ["", "No preference yet"],
  ].forEach(function (pair) {
    var line = document.createElement("p");
    line.textContent =
      pair[1] + ": " + ((stayCounts && stayCounts[pair[0]]) || 0);
    box.appendChild(line);
  });
}

function renderTipiBySize(counts) {
  var box = document.querySelector("#tipi-by-size");
  box.innerHTML = "";
  [
    ["tipi2", "Tipi, up to 2 people"],
    ["star2", "Star Tent, up to 2 people"],
    ["star5", "5-Star Tent, up to 5 people"],
    ["tipi6", "Tipi, up to 6 people"],
  ].forEach(function (pair) {
    var line = document.createElement("p");
    line.textContent = pair[1] + ": " + (counts[pair[0]] || 0);
    box.appendChild(line);
  });
}

function renderMembers(result) {
  var body = document.querySelector("#member-rows");
  body.innerHTML = "";
  state.kaptains = [];
  state.tickets = [];
  state.bought = [];
  renderPeopleRows("#kaptain-rows", [], 3);
  renderPeopleRows("#ticket-rows", [], 9);
  renderPeopleRows("#bought-rows", [], 4);
  state.admin = result.person.admin === "yes";
  if (!state.admin) {
    if (location.hash === "#admin" || location.hash === "#payments") {
      history.replaceState(null, "", location.pathname + location.search);
    }
    return;
  }
  renderTipiBySize(result.tipi_by_size || {});
  if (result.signup_count != null) {
    renderSignupCounts(result.signup_count, result.stay_counts);
  }
  (result.payments || []).forEach(function (member) {
    var fields = [
      ["Name", member.full_name],
      ["Kode", member.member_code],
      ["Email", member.email],
      ["WhatsApp", member.whatsapp],
      ["Email you used registering for boom", member.boomer_email],
      ["Sleeping", memberStay(member.stay)],
      ["At sale", memberSale(member.sale_available)],
      ["Potential Kaptain", memberYes(member.kaptain)],
      ["Ticket name", ticketCell(member, member.ticket_name)],
      ["Ticket email", ticketCell(member, member.ticket_email)],
      ["Date of birth", ticketCell(member, member.ticket_birth)],
      ["Gender", ticketCell(member, memberGender(member.ticket_gender))],
      ["Nationality", ticketCell(member, member.ticket_nationality)],
      ["Residency", ticketCell(member, member.ticket_residency)],
      ["Bought", memberYes(member.purchased)],
      ["Tent", memberTent(member.purchased_size)],
      ["Stable mates", memberMates(member.share_with)],
      ["Amount", member.amount],
      ["Reference", member.payment_ref],
      ["Kamp fee", memberYes(member.camp_fee_paid)],
    ];
    var row = document.createElement("tr");
    fields.forEach(function (pair) {
      var cell = document.createElement("td");
      cell.textContent = pair[1] || "";
      row.appendChild(cell);
    });
    row.addEventListener("click", function () {
      var next = row.nextElementSibling;
      var open = next && next.classList.contains("member-detail");
      closeMemberDetails();
      if (open) {
        return;
      }
      row.after(memberDetail(fields));
    });
    body.appendChild(row);
  });
  var people = result.payments || [];
  state.kaptains = people.filter(function (member) {
    return member.kaptain === "yes";
  });
  state.tickets = people.filter(function (member) {
    return member.needs_ticket === "yes";
  });
  state.bought = people.filter(function (member) {
    return member.purchased === "yes";
  });
  renderPeopleRows("#kaptain-rows", state.kaptains, 3, function (member) {
    return [member.full_name, member.member_code, member.whatsapp];
  });
  renderPeopleRows("#ticket-rows", state.tickets, 9, function (member) {
    return [
      member.full_name,
      member.member_code,
      member.whatsapp,
      member.ticket_name,
      member.ticket_email,
      member.ticket_birth,
      memberGender(member.ticket_gender),
      member.ticket_nationality,
      member.ticket_residency,
    ];
  });
  renderPeopleRows("#bought-rows", state.bought, 4, function (member) {
    return [
      member.full_name,
      member.member_code,
      member.whatsapp,
      memberTent(member.purchased_size),
    ];
  });
}

function renderPeopleRows(selector, people, columns, values) {
  var body = document.querySelector(selector);
  body.innerHTML = "";
  if (!people.length) {
    var empty = document.createElement("tr");
    var cell = document.createElement("td");
    cell.colSpan = columns;
    cell.textContent = "Nobody yet.";
    empty.appendChild(cell);
    body.appendChild(empty);
    return;
  }
  people.forEach(function (member) {
    var row = document.createElement("tr");
    values(member).forEach(function (value) {
      var cell = document.createElement("td");
      cell.textContent = value || "";
      row.appendChild(cell);
    });
    body.appendChild(row);
  });
}

function copyPhones(people, button) {
  var numbers = people
    .map(function (member) {
      return String(member.whatsapp || "").trim();
    })
    .filter(Boolean);
  var previous = button.textContent;
  if (!numbers.length) {
    button.textContent = "No phone numbers";
    window.setTimeout(function () {
      button.textContent = previous;
    }, 1500);
    return;
  }
  var text = numbers.join(", ");
  var done = function () {
    button.textContent = "Copied";
    window.setTimeout(function () {
      button.textContent = previous;
    }, 1500);
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(done, function () {
      copyWithFallback(text);
      done();
    });
    return;
  }
  copyWithFallback(text);
  done();
}

function copyWithFallback(text) {
  var area = document.createElement("textarea");
  area.value = text;
  document.body.appendChild(area);
  area.select();
  document.execCommand("copy");
  area.remove();
}

function closeMemberDetails() {
  document.querySelectorAll(".member-detail").forEach(function (detail) {
    detail.remove();
  });
}

function memberDetail(fields) {
  var detail = document.createElement("tr");
  detail.className = "member-detail";
  var cell = document.createElement("td");
  cell.colSpan = fields.length;
  var box = document.createElement("div");
  box.className = "member-box";
  fields.forEach(function (pair) {
    var line = document.createElement("p");
    var label = document.createElement("span");
    label.className = "member-label";
    label.textContent = pair[0];
    line.appendChild(label);
    line.appendChild(document.createTextNode(pair[1] || "—"));
    box.appendChild(line);
  });
  cell.appendChild(box);
  detail.appendChild(cell);
  return detail;
}

function memberStay(stay) {
  var value = String(stay || "");
  if (value === "arrange") {
    return "I arrange myself";
  }
  if (value === "4" || value === "5" || value === "6") {
    return value + " people";
  }
  return "";
}

function memberTent(size) {
  return (
    {
      tipi2: "Tipi, up to 2 people",
      star2: "Star Tent, up to 2 people",
      star5: "5-Star Tent, up to 5 people",
      tipi6: "Tipi, up to 6 people",
    }[size] || ""
  );
}

function memberYes(value) {
  return value === "yes" ? "Yes" : "";
}

function memberSale(value) {
  if (value === "yes") {
    return "Yes";
  }
  if (value === "no") {
    return "No";
  }
  return "";
}

function memberGender(value) {
  return { male: "Male", female: "Female", other: "Other" }[value] || "";
}

function ticketCell(member, value) {
  return member.needs_ticket === "yes" ? value || "" : "";
}

function memberMates(codes) {
  return (codes || [])
    .map(function (code) {
      if (code === state.memberCode) {
        var name = document.querySelector("#profile-form").full_name.value;
        return name ? name + " (" + code + ")" : code;
      }
      return labelFor(code);
    })
    .join(", ");
}

function moveButton(text, index, direction) {
  var button = document.createElement("button");
  button.type = "button";
  button.textContent = text;
  button.addEventListener("click", function () {
    var next = index + direction;
    if (next < 0 || next >= state.companions.length) {
      return;
    }
    var swapped = state.companions[index];
    state.companions[index] = state.companions[next];
    state.companions[next] = swapped;
    renderCompanions();
  });
  return button;
}

function removeButton(index) {
  var button = document.createElement("button");
  button.type = "button";
  button.textContent = "Remove";
  button.addEventListener("click", function () {
    state.companions.splice(index, 1);
    renderCompanions();
  });
  return button;
}

function labelFor(code) {
  var person = state.directory.filter(function (row) {
    return row.member_code === code;
  })[0];
  if (!person) {
    return code;
  }
  var who = person.full_name || person.email;
  if (!who) {
    return code;
  }
  return who + " - (" + code + ")";
}

function readSession() {
  var prefix = sessionKey + "=";
  var parts = document.cookie ? document.cookie.split(";") : [];
  for (var i = 0; i < parts.length; i++) {
    var part = parts[i].trim();
    if (part.indexOf(prefix) !== 0) {
      continue;
    }
    try {
      return JSON.parse(decodeURIComponent(part.slice(prefix.length)));
    } catch (error) {
      return null;
    }
  }
  return null;
}

function writeSession(value) {
  document.cookie =
    sessionKey +
    "=" +
    encodeURIComponent(JSON.stringify(value)) +
    "; Max-Age=2592000; Path=/; SameSite=Lax; Secure";
}

function clearSession() {
  document.cookie = sessionKey + "=; Max-Age=0; Path=/; SameSite=Lax; Secure";
  document.cookie =
    sessionKey + "=; Max-Age=0; Path=/herd-roundup; SameSite=Lax; Secure";
}

function logout() {
  if (useFirebase_() && window.firebase && firebase.auth) {
    firebase.auth().signOut();
  }
  clearSession();
  state.memberCode = "";
  state.email = "";
  state.admin = false;
  if (location.hash) {
    history.replaceState(null, "", location.pathname + location.search);
  }
  profile.hidden = true;
  document.querySelector("#admin").hidden = true;
  document.querySelector("#nav").hidden = true;
  auth.hidden = false;
  var hello = document.querySelector("#hello");
  hello.textContent = "";
  hello.hidden = true;
  say("Logged out.");
}

function showHello(person) {
  var name = String(person.full_name || "").trim();
  var hello = document.querySelector("#hello");
  hello.textContent = "Hi " + (name || person.email);
  hello.hidden = false;
}

function retryableError(message) {
  return (
    message === "The sheet is busy. Wait a moment and try again." ||
    message === "The script took too long. Wait a moment and try again."
  );
}

function toast(message, failed) {
  var el = document.querySelector("#toast");
  el.textContent = message;
  el.classList.toggle("failed", !!failed);
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () {
    el.hidden = true;
  }, 4500);
}

function callServer(body, options) {
  if (serverBusy) {
    return Promise.resolve({ ok: false, skipped: true });
  }
  serverBusy = true;
  options = options || {};
  var attempt = 1;
  var cancel = false;
  var seconds = RETRY_SECONDS;
  var timer = null;

  function stopTimer() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  function renderWait() {
    var cancelBtn = document.querySelector("#busy-cancel");
    var countdown = document.querySelector("#busy-countdown");
    var message = options.pending || "Working…";
    var detail = "";
    var crowd = "A lot of people are using the app right now.";
    if (cancel) {
      message = "Stopping after this try.";
      detail = seconds > 0 ? seconds + "s left." : "Still waiting. " + crowd;
      cancelBtn.disabled = true;
    } else if (attempt >= RETRY_LIMIT) {
      message = "The sheet is busy.";
      detail =
        seconds > 0
          ? "Last try. " + seconds + "s left."
          : "Last try. Still waiting. " + crowd;
      cancelBtn.disabled = false;
    } else if (attempt > 1) {
      message = "The sheet is busy.";
      detail =
        seconds > 0
          ? "Trying again. " +
            attempt +
            " of " +
            RETRY_LIMIT +
            ". " +
            seconds +
            "s left."
          : "Still waiting. Try " +
            attempt +
            " of " +
            RETRY_LIMIT +
            ". " +
            crowd;
      cancelBtn.disabled = false;
    } else if (seconds === 0) {
      detail = "Still waiting. " + crowd;
      cancelBtn.disabled = false;
    } else {
      cancelBtn.disabled = false;
    }
    document.querySelector("#busy-message").textContent = message;
    countdown.textContent = detail;
    countdown.hidden = detail === "";
    cancelBtn.hidden = false;
  }

  function arm() {
    seconds = RETRY_SECONDS;
    stopTimer();
    renderWait();
    timer = setInterval(function () {
      if (seconds > 0) {
        seconds -= 1;
      }
      renderWait();
    }, 1000);
  }

  requestBusyCancel = function () {
    if (cancel) {
      return;
    }
    cancel = true;
    renderWait();
  };

  function succeed(result) {
    stopTimer();
    var success = options.success;
    if (!success) {
      hideBusy();
      return Promise.resolve(result);
    }
    if (typeof success === "function") {
      success = success(result);
    }
    var extra = {};
    if (success && typeof success === "object") {
      extra = success;
      success = success.message;
    }
    if (extra.password) {
      return finishBusy(success, extra).then(function () {
        return result;
      });
    }
    hideBusy();
    if (success) {
      toast(success, false);
    }
    return Promise.resolve(result);
  }

  function giveUpBusy() {
    stopTimer();
    hideBusy();
    toast(options.failed || "Saving failed.", true);
    return Promise.resolve({
      ok: false,
      error: options.failed || "Saving failed.",
      cancelled: cancel,
    });
  }

  function giveUpError(result) {
    stopTimer();
    return finishBusy(result.error || "Something went wrong.").then(
      function () {
        return result;
      },
    );
  }

  function once() {
    arm();
    return post(body).then(function (result) {
      if (result.ok) {
        return succeed(result);
      }
      if (retryableError(result.error) && !cancel && attempt < RETRY_LIMIT) {
        attempt += 1;
        return once();
      }
      if (retryableError(result.error)) {
        return giveUpBusy();
      }
      return giveUpError(result);
    });
  }

  function run() {
    return once().catch(function (error) {
      var message = error.message || "The request failed.";
      if (retryableError(message) && !cancel && attempt < RETRY_LIMIT) {
        attempt += 1;
        return run();
      }
      if (retryableError(message)) {
        return giveUpBusy();
      }
      stopTimer();
      return finishBusy(message).then(function () {
        return { ok: false, error: message };
      });
    });
  }

  showBusy(options.pending || "Working…");
  return run().then(function (result) {
    stopTimer();
    requestBusyCancel = function () {};
    serverBusy = false;
    return result;
  });
}

function post(body) {
  if (!SCRIPT_URL) {
    return Promise.reject(new Error("The script URL is not set yet."));
  }
  return fetch(SCRIPT_URL, {
    method: "POST",
    redirect: "follow",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(body),
  })
    .then(function (response) {
      return response.text();
    })
    .then(function (text) {
      try {
        return JSON.parse(text);
      } catch (error) {
        throw new Error(
          "The script took too long. Wait a moment and try again.",
        );
      }
    });
}

function showBusy(message) {
  document.querySelector("main").inert = true;
  document.querySelector("#busy-spinner").hidden = false;
  document.querySelector("#busy-ok").hidden = true;
  document.querySelector("#busy-cancel").hidden = true;
  document.querySelector("#busy-cancel").disabled = false;
  document.querySelector("#busy-countdown").hidden = true;
  document.querySelector("#busy-countdown").textContent = "";
  document.querySelector("#toast").hidden = true;
  clearTimeout(toastTimer);
  document.querySelector("#busy-message").textContent = message;
  clearBusySecret();
  var busy = document.querySelector("#busy");
  busy.hidden = false;
  document.querySelector(".busy-card").focus();
}

function hideBusy() {
  clearBusySecret();
  document.querySelector("#busy").hidden = true;
  document.querySelector("main").inert = false;
}

function clearBusySecret() {
  var text = document.querySelector("#busy-password-text");
  var warning = document.querySelector("#busy-warning");
  text.textContent = "";
  text.hidden = true;
  delete document.querySelector("#busy-ok").dataset.email;
  warning.hidden = true;
}

function finishBusy(message, extra) {
  extra = extra || {};
  document.querySelector("#busy-spinner").hidden = true;
  document.querySelector("#busy-cancel").hidden = true;
  document.querySelector("#busy-countdown").hidden = true;
  document.querySelector("#busy-message").textContent = message;
  var form = document.querySelector("#busy-save");
  var warning = document.querySelector("#busy-warning");
  var ok = document.querySelector("#busy-ok");
  if (extra.password) {
    var text = document.querySelector("#busy-password-text");
    text.textContent = extra.password;
    text.hidden = false;
    ok.dataset.email = extra.email || "";
    ok.type = "submit";
    ok.setAttribute("form", "login-form");
  } else {
    ok.type = "button";
    ok.removeAttribute("form");
  }
  if (extra.warning) {
    warning.textContent = extra.warning;
    warning.hidden = false;
  }
  ok.hidden = false;
  if (!extra.password) {
    ok.focus();
  }
  return new Promise(function (resolve) {
    var settled = false;
    function done() {
      if (settled) {
        return;
      }
      settled = true;
      form.onsubmit = null;
      ok.onclick = null;
      ok.type = "button";
      ok.removeAttribute("form");
      hideBusy();
      resolve();
    }
    form.onsubmit = function (event) {
      event.preventDefault();
      var credential = passwordCredential_(form);
      if (credential && navigator.credentials && navigator.credentials.store) {
        navigator.credentials.store(credential).catch(function () {
          return null;
        });
      }
      window.setTimeout(done, 400);
    };
    ok.onclick = function () {
      if (ok.getAttribute("form") === "login-form") {
        window.setTimeout(done, 0);
        return;
      }
      done();
    };
  });
}

function notifyLoginField_(input) {
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function passwordCredential_(form) {
  if (!form.password || !form.password.value || !window.PasswordCredential) {
    return null;
  }
  try {
    return new PasswordCredential(form);
  } catch (error) {
    return null;
  }
}

function say(message) {
  notice.textContent = message;
}

var infoDocUrl =
  "https://docs.google.com/document/d/1L9-oL4jE1gBBlrhNhMI-OgYSZEpb3gkvfUkylfe1K6k/export?format=html";

function loadInfo() {
  var info = document.querySelector("#info");
  if (!info.open || info.dataset.loaded === "yes") {
    return;
  }
  info.dataset.loaded = "yes";
  var status = document.querySelector("#info-status");
  var frame = document.querySelector("#info-frame");
  status.hidden = false;
  status.textContent = "Loading info…";
  fetch(infoDocUrl)
    .then(function (response) {
      if (!response.ok) {
        throw new Error("The info doc could not be loaded.");
      }
      return response.text();
    })
    .then(function (html) {
      if (html.indexOf("<html") === -1) {
        throw new Error("The info doc could not be loaded.");
      }
      frame.addEventListener("load", function () {
        bindInfoLinks_(frame);
        fitInfoFrame_(frame);
      });
      frame.srcdoc = openableInfoHtml_(html);
      bindInfoLinks_(frame);
      status.hidden = true;
    })
    .catch(function (error) {
      info.dataset.loaded = "";
      status.textContent = error.message || "The info doc could not be loaded.";
    });
}

loadInfo();

function fitInfoFrame_(frame) {
  var doc = frame.contentDocument;
  var root = doc && doc.documentElement;
  if (!root) {
    return;
  }
  frame.style.height = root.scrollHeight + "px";
  var box = frame.parentNode;
  box.style.overflow = "hidden";
  void box.offsetHeight;
  box.style.overflow = "auto";
  if (root.dataset.infoScrollBound === "yes") {
    return;
  }
  root.dataset.infoScrollBound = "yes";
  var refit = function () {
    frame.style.height = root.scrollHeight + "px";
  };
  var images = doc.images;
  for (var i = 0; i < images.length; i++) {
    if (!images[i].complete) {
      images[i].addEventListener("load", refit);
    }
  }
  doc.addEventListener(
    "wheel",
    function (event) {
      if (event.ctrlKey || event.metaKey) {
        return;
      }
      var max = box.scrollHeight - box.clientHeight;
      if (max <= 0) {
        return;
      }
      var atTop = box.scrollTop <= 0 && event.deltaY < 0;
      var atBottom = box.scrollTop >= max && event.deltaY > 0;
      if (atTop || atBottom) {
        return;
      }
      var step = event.deltaY;
      if (event.deltaMode === 1) {
        step *= 16;
      } else if (event.deltaMode === 2) {
        step *= box.clientHeight;
      }
      box.scrollTop += step;
      event.preventDefault();
    },
    { passive: false },
  );
}

function bindInfoLinks_(frame) {
  var doc;
  try {
    doc = frame.contentDocument;
  } catch (error) {
    return;
  }
  if (!doc) {
    return;
  }
  var links = doc.querySelectorAll("a[href]");
  for (var i = 0; i < links.length; i++) {
    if (links[i].dataset.infoBound === "yes") {
      continue;
    }
    links[i].dataset.infoBound = "yes";
    links[i].addEventListener("click", onInfoLinkClick_);
  }
}

function onInfoLinkClick_(event) {
  var href = infoLinkHref_(event.currentTarget.getAttribute("href") || "");
  if (!href || href.charAt(0) === "#") {
    return;
  }
  event.preventDefault();
  var opener = document.createElement("a");
  opener.href = href;
  opener.target = "_blank";
  opener.rel = "noopener noreferrer";
  document.body.appendChild(opener);
  opener.click();
  opener.remove();
}

function linkBareInfoUrls_(html) {
  var parts = html.split(/(<[^>]+>)/g);
  var inAnchor = false;
  return parts
    .map(function (part) {
      if (part.charAt(0) === "<") {
        if (/^<a\b/i.test(part)) {
          inAnchor = true;
        } else if (/^<\/a\b/i.test(part)) {
          inAnchor = false;
        }
        return part;
      }
      if (inAnchor) {
        return part;
      }
      return part.replace(/https?:\/\/[^\s<]+/g, function (url) {
        var clean = url.replace(/[),.;]+$/, "");
        var trailing = url.slice(clean.length);
        return (
          '<a href="' +
          escapeInfoAttr_(clean) +
          '">' +
          clean +
          "</a>" +
          trailing
        );
      });
    })
    .join("");
}

function openableInfoHtml_(html) {
  var styled = linkBareInfoUrls_(html).replace(
    "</head>",
    "<style>html,body{height:auto !important;overflow:visible !important}body{padding:16px !important;max-width:none !important}a[href]{color:#1f3d32 !important;text-decoration:underline !important;cursor:pointer}</style></head>",
  );
  return styled.replace(/<a\b([^>]*)>/gi, function (tag, attrs) {
    var hrefMatch = attrs.match(/href="([^"]*)"/i);
    if (!hrefMatch) {
      return tag;
    }
    var href = infoLinkHref_(hrefMatch[1]);
    var next = attrs.replace(
      /href="[^"]*"/i,
      'href="' + escapeInfoAttr_(href) + '"',
    );
    if (!/\btarget=/i.test(next)) {
      next += ' target="_blank"';
    }
    if (!/\brel=/i.test(next)) {
      next += ' rel="noopener noreferrer"';
    }
    return "<a" + next + ">";
  });
}

function infoLinkHref_(value) {
  var decoded = value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"');
  try {
    var url = new URL(decoded);
    var target = url.searchParams.get("q");
    if (
      url.hostname === "www.google.com" &&
      url.pathname === "/url" &&
      target
    ) {
      return target;
    }
  } catch (error) {
    return decoded;
  }
  return decoded;
}

function escapeInfoAttr_(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

function openInfoOnce(memberCode) {
  if (!memberCode) {
    return;
  }
  var key = "herd-roundup-info-" + memberCode;
  var seen = false;
  try {
    seen = localStorage.getItem(key) === "yes";
  } catch (error) {
    seen = false;
  }
  if (seen) {
    return;
  }
  var info = document.querySelector("#info");
  info.open = true;
  loadInfo();
  info.scrollIntoView({ block: "start" });
  try {
    localStorage.setItem(key, "yes");
  } catch (error) {
    return;
  }
}

function showWhatsapp(value) {
  var number = String(value || "").trim();
  if (/^\d{8,15}$/.test(number)) {
    return "+" + number;
  }
  return number;
}

function whatsappProblem(value) {
  var number = String(value || "").trim();
  if (!number) {
    return "Enter a WhatsApp number.";
  }
  if (number.charAt(0) !== "+") {
    return "Start the WhatsApp number with a country kode, such as +41 or +49.";
  }
  var digits = number.replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 15) {
    return "Enter a WhatsApp number.";
  }
  return "";
}

function profileProblems() {
  var form = document.querySelector("#profile-form");
  var problems = [];
  var whatsappError = whatsappProblem(form.whatsapp.value);
  if (whatsappError) {
    problems.push({ field: "whatsapp", error: whatsappError });
  }
  var village = document.querySelector("#village-select").value;
  var size = document.querySelector("#size-select").value;
  if (village === "yes" && size !== "4" && size !== "5" && size !== "6") {
    problems.push({
      field: "stay",
      error: "Choose how many people will sleep in the tent.",
    });
  }
  var bought = form.purchased.checked;
  var boughtSize = form.purchased_size.value;
  if (bought && !boughtSize) {
    problems.push({
      field: "purchased_size",
      error: "Choose which tent or tipi you bought.",
    });
  }
  if (form.sale_available.value === "no" && form.needs_ticket.checked) {
    if (!form.ticket_name.value.trim()) {
      problems.push({ field: "ticket_name", error: "Enter the name." });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.ticket_email.value.trim())) {
      problems.push({ field: "ticket_email", error: "Enter an email." });
    }
    if (!form.ticket_birth.value) {
      problems.push({
        field: "ticket_birth",
        error: "Enter a date of birth.",
      });
    }
    if (
      form.ticket_gender.value !== "male" &&
      form.ticket_gender.value !== "female" &&
      form.ticket_gender.value !== "other"
    ) {
      problems.push({
        field: "ticket_gender",
        error: "Choose male, female, or other.",
      });
    }
    if (!form.ticket_nationality.value.trim()) {
      problems.push({
        field: "ticket_nationality",
        error: "Enter a nationality.",
      });
    }
    if (!form.ticket_residency.value.trim()) {
      problems.push({
        field: "ticket_residency",
        error: "Enter a residency.",
      });
    }
  }
  if (!bought && boughtSize) {
    problems.push({
      field: "purchased",
      error: "Tick I bought one, or clear which tent or tipi you chose.",
    });
  }
  var stay = document.querySelector("#stay-hidden").value;
  if (
    state.companions.length > 0 &&
    stay !== "4" &&
    stay !== "5" &&
    stay !== "6"
  ) {
    problems.push({
      field: "share_with",
      error:
        stay === "arrange"
          ? "You kan add people only when you choose a tent or a tipi."
          : "Choose a sleeping preference before adding people.",
    });
  } else {
    var seen = {};
    for (var i = 0; i < state.companions.length; i++) {
      var code = String(state.companions[i]);
      if (code === state.memberCode) {
        problems.push({
          field: "share_with",
          error: "You kan't list yourself.",
        });
        break;
      }
      if (seen[code]) {
        problems.push({ field: "share_with", error: "List each person once." });
        break;
      }
      if (code.indexOf(",") !== -1) {
        problems.push({
          field: "share_with",
          error: "Names kan't contain a comma.",
        });
        break;
      }
      seen[code] = true;
    }
  }
  return problems;
}

function clearFieldError(field) {
  var el = document.querySelector('.field-error[data-field="' + field + '"]');
  if (!el) {
    return;
  }
  el.hidden = true;
  el.textContent = "";
}

function clearFieldErrors() {
  document.querySelectorAll(".field-error").forEach(function (el) {
    el.hidden = true;
    el.textContent = "";
  });
}

function showFieldErrors(problems) {
  clearFieldErrors();
  var seen = {};
  problems.forEach(function (problem) {
    if (seen[problem.field]) {
      return;
    }
    seen[problem.field] = true;
    var el = document.querySelector(
      '.field-error[data-field="' + problem.field + '"]',
    );
    if (!el) {
      return;
    }
    el.hidden = false;
    el.textContent = problem.error;
  });
  var first = document.querySelector(".field-error:not([hidden])");
  if (first && first.scrollIntoView) {
    first.scrollIntoView({ block: "center" });
  }
}

var firebaseAnnounce = "";

function useFirebase_() {
  return typeof USE_FIREBASE !== "undefined" && USE_FIREBASE;
}

function fieldSecret(input) {
  if (!input) {
    return "";
  }
  if (input.type === "password") {
    return input.value;
  }
  return input.dataset.held || "";
}

function bindHeldSecret(input) {
  input.addEventListener("input", function () {
    if (input.type === "password") {
      input.dataset.held = input.value;
      return;
    }
    var shown = input.value;
    var held = input.dataset.held || "";
    if (/^•*$/.test(shown)) {
      input.dataset.held = held.slice(0, shown.length);
    } else {
      var lead = 0;
      while (lead < shown.length && shown.charAt(lead) === "•") {
        lead += 1;
      }
      var trail = 0;
      while (
        trail < shown.length - lead &&
        shown.charAt(shown.length - 1 - trail) === "•"
      ) {
        trail += 1;
      }
      var middle = shown.slice(lead, shown.length - trail).replace(/•/g, "");
      var tail = trail ? held.slice(held.length - trail) : "";
      input.dataset.held = held.slice(0, lead) + middle + tail;
    }
    var masked = (input.dataset.held || "").replace(/./g, "•");
    if (input.value !== masked) {
      input.value = masked;
    }
  });
}

function singlePasswordField_(which) {
  setSecretField_(
    document.querySelector("#register-secret"),
    which === "register",
    "new-password",
  );
  setSecretField_(
    document.querySelector("#login-secret"),
    which === "login",
    "current-password",
  );
}

function setSecretField_(input, real, autocomplete) {
  var held = input.type === "password" ? input.value : input.dataset.held || "";
  input.dataset.held = held;
  if (real) {
    input.type = "password";
    input.name = "password";
    input.setAttribute("autocomplete", autocomplete);
    input.value = held;
    return;
  }
  input.type = "text";
  input.name = "unused";
  input.setAttribute("autocomplete", "off");
  input.value = held.replace(/./g, "•");
}

function startFirebase() {
  var registerForm = document.querySelector("#register-form");
  var registerSecret = document.querySelector("#register-secret");
  var registerAgain = document.querySelector("#register-again");
  document.querySelector("#register-whatsapp").hidden = true;
  registerForm.elements.whatsapp.required = false;
  document.querySelector("#register-password").hidden = false;
  document.querySelector("#register-password-again").hidden = false;
  registerSecret.required = true;
  registerAgain.required = true;
  bindHeldSecret(registerSecret);
  bindHeldSecret(registerAgain);
  bindHeldSecret(document.querySelector("#login-secret"));
  registerForm.addEventListener("focusin", function () {
    singlePasswordField_("register");
  });
  document
    .querySelector("#login-form")
    .addEventListener("focusin", function () {
      singlePasswordField_("login");
    });
  singlePasswordField_("login");
  document.querySelector("#reset-submit").textContent = "Email me a reset link";
  loadFirebaseScripts()
    .then(function () {
      firebase.initializeApp(FIREBASE_CONFIG);
      firebase.auth().onAuthStateChanged(onFirebaseUser);
    })
    .catch(function () {
      say("Could not load Firebase.");
    });
}

function loadFirebaseScripts() {
  var version = "12.19.0";
  var base = "https://www.gstatic.com/firebasejs/" + version + "/";
  return loadScript(base + "firebase-app-compat.js").then(function () {
    return Promise.all([
      loadScript(base + "firebase-auth-compat.js"),
      loadScript(base + "firebase-firestore-compat.js"),
    ]);
  });
}

function loadScript(src) {
  return new Promise(function (resolve, reject) {
    var script = document.createElement("script");
    script.src = src;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

function signInWithFirebase(email, password) {
  if (!window.firebase || !firebase.auth) {
    say("Still loading.");
    return;
  }
  firebaseAnnounce = "signed-in";
  showBusy("Signing in…");
  firebase
    .auth()
    .signInWithEmailAndPassword(String(email || "").trim(), password)
    .catch(function (error) {
      firebaseAnnounce = "";
      hideBusy();
      toast(firebaseProblem(error, "Sign-in failed."), true);
    });
}

function registerWithFirebase(form) {
  if (!window.firebase || !firebase.auth) {
    say("Still loading.");
    return;
  }
  var password = fieldSecret(document.querySelector("#register-secret"));
  var again = fieldSecret(document.querySelector("#register-again"));
  var error = form.querySelector('[data-field="register-password"]');
  if (password.length < 8) {
    error.hidden = false;
    error.textContent = "Use at least 8 characters.";
    return;
  }
  if (password !== again) {
    error.hidden = false;
    error.textContent = "Those passwords don't match.";
    return;
  }
  error.hidden = true;
  error.textContent = "";
  firebaseAnnounce = "registered";
  showBusy("Registering…");
  firebase
    .auth()
    .createUserWithEmailAndPassword(
      String(form.elements.email.value || "").trim(),
      password,
    )
    .catch(function (error) {
      firebaseAnnounce = "";
      hideBusy();
      toast(firebaseProblem(error, "Registration failed."), true);
    });
}

function resetWithFirebase(email) {
  if (!window.firebase || !firebase.auth) {
    say("Still loading.");
    return;
  }
  showBusy("Sending a reset link…");
  firebase
    .auth()
    .sendPasswordResetEmail(String(email || "").trim())
    .then(function () {
      hideBusy();
      toast("If that email is registered, a reset link is on its way.");
    })
    .catch(function (error) {
      hideBusy();
      toast(firebaseProblem(error, "Could not send a reset link."), true);
    });
}

function onFirebaseUser(user) {
  if (!user) {
    return;
  }
  var announce = firebaseAnnounce;
  firebaseAnnounce = "";
  showBusy(announce === "registered" ? "Registering…" : "Signing in…");
  loadFirebaseProfile(user)
    .then(function (result) {
      hideBusy();
      if (!result.ok) {
        say(result.error);
        if (announce === "registered") {
          toast("Registered.");
        }
        return;
      }
      showSession(result);
      if (announce === "registered") {
        toast("Registered.");
      } else if (announce === "signed-in") {
        toast("Signed in.");
      }
    })
    .catch(function () {
      hideBusy();
      toast("Sign-in failed.", true);
    });
}

function loadFirebaseProfile(user) {
  var db = firebase.firestore();
  return db
    .collection("people")
    .doc(user.uid)
    .get()
    .then(function (snap) {
      if (!snap.exists) {
        return db
          .collection("directory")
          .get()
          .then(function (directorySnap) {
            return {
              ok: true,
              person: campPerson_({ email: user.email }, user.email),
              directory: readDirectory_(directorySnap),
              tipi_count: null,
            };
          });
      }
      return db
        .collection("directory")
        .get()
        .then(function (directorySnap) {
          var person = campPerson_(snap.data(), user.email);
          var directory = readDirectory_(directorySnap);
          var result = {
            ok: true,
            person: person,
            directory: directory,
            tipi_count: null,
          };
          if (person.admin !== "yes") {
            return result;
          }
          return db
            .collection("people")
            .get()
            .then(function (peopleSnap) {
              var people = [];
              peopleSnap.forEach(function (doc) {
                people.push(campPerson_(doc.data(), ""));
              });
              result.payments = people;
              result.signup_count = people.length;
              result.stay_counts = {};
              result.tipi_by_size = {};
              result.tipi_count = 0;
              people.forEach(function (member) {
                var stay = member.stay || "";
                result.stay_counts[stay] = (result.stay_counts[stay] || 0) + 1;
                if (member.purchased === "yes") {
                  result.tipi_count += 1;
                  if (member.purchased_size) {
                    result.tipi_by_size[member.purchased_size] =
                      (result.tipi_by_size[member.purchased_size] || 0) + 1;
                  }
                }
              });
              return result;
            });
        });
    });
}

function readDirectory_(directorySnap) {
  var directory = [];
  directorySnap.forEach(function (doc) {
    var data = doc.data();
    directory.push({
      member_code: data.member_code || "",
      full_name: data.full_name || "",
      email: data.email || "",
      share_with: data.share_with || [],
    });
  });
  return directory;
}

function profileDraft(data) {
  var purchased = data.get("purchased") ? "yes" : "";
  var sale = data.get("sale_available");
  if (sale !== "yes" && sale !== "no") {
    sale = "";
  }
  var ticket = ticketPayload(data);
  return {
    full_name: String(data.get("full_name") || "").trim(),
    stay: String(data.get("stay") || ""),
    boomer_email: String(data.get("boomer_email") || "").trim(),
    purchased: purchased,
    purchased_size: String(data.get("purchased_size") || ""),
    whatsapp: storedWhatsapp(data.get("whatsapp")),
    share_with: state.companions.map(function (item) {
      return String(item);
    }),
    sale_available: sale,
    kaptain: data.get("kaptain") === "yes" ? "yes" : "",
    needs_ticket: ticket.needs_ticket,
    ticket_name: ticket.ticket_name,
    ticket_email: ticket.ticket_email,
    ticket_birth: ticket.ticket_birth,
    ticket_gender: ticket.ticket_gender,
    ticket_nationality: ticket.ticket_nationality,
    ticket_residency: ticket.ticket_residency,
  };
}

function saveWithFirebase(data) {
  if (!window.firebase || !firebase.auth || !firebase.firestore) {
    say("Still loading.");
    return;
  }
  var user = firebase.auth().currentUser;
  if (!user) {
    say("Log in again.");
    return;
  }
  var problems = profileProblems();
  if (problems.length) {
    showFieldErrors(problems);
    return;
  }
  var draft = profileDraft(data);
  var extra = draftProblems(draft);
  if (extra.length) {
    showFieldErrors(extra);
    return;
  }
  clearFieldErrors();
  showBusy("Saving…");
  var db = firebase.firestore();
  var personRef = db.collection("people").doc(user.uid);
  var counterRef = db.collection("counters").doc("member");
  var now = new Date().toISOString();
  db.runTransaction(function (tx) {
    return tx.get(personRef).then(function (snap) {
      if (snap.exists) {
        var current = snap.data();
        var written = peopleWrite(draft, {
          member_code: current.member_code,
          email: current.email,
          admin: current.admin,
          camp_fee_paid: current.camp_fee_paid,
          amount: current.amount,
          payment_ref: current.payment_ref,
          purchased_at: purchasedAtFor(current, draft.purchased, now),
        });
        tx.update(personRef, written);
        return written;
      }
      return tx.get(counterRef).then(function (counterSnap) {
        var number = counterSnap.data().next;
        var created = peopleWrite(draft, {
          member_code: memberCodeFromNumber(number),
          email: user.email,
          admin: false,
          camp_fee_paid: "",
          amount: "",
          payment_ref: "",
          purchased_at: purchasedAtFor({ purchased: "" }, draft.purchased, now),
        });
        tx.set(personRef, created);
        tx.update(counterRef, { next: number + 1 });
        return created;
      });
    });
  })
    .then(function (written) {
      return db
        .collection("directory")
        .doc(user.uid)
        .set(directoryEntry(written));
    })
    .then(function () {
      return loadFirebaseProfile(user);
    })
    .then(function (result) {
      hideBusy();
      if (!result.ok) {
        say(result.error);
        return;
      }
      showSession(result);
      toast("Saved.");
    })
    .catch(function () {
      hideBusy();
      toast("Saving failed.", true);
    });
}

function campPerson_(data, email) {
  var person = data || {};
  var stay = person.stay || "";
  return {
    member_code: person.member_code || "",
    email: person.email || email || "",
    full_name: person.full_name || "",
    admin: person.admin === true || person.admin === "yes" ? "yes" : "",
    stay: stay,
    purchased: person.purchased || "",
    purchased_size: person.purchased_size || "",
    purchased_at: person.purchased_at || "",
    boomer_email: person.boomer_email || "",
    share_with: person.share_with || [],
    camp_fee_paid: person.camp_fee_paid || "",
    amount: person.amount || "",
    payment_ref: person.payment_ref || "",
    whatsapp: person.whatsapp || "",
    sale_available: person.sale_available || "",
    kaptain: person.kaptain || "",
    needs_ticket: person.needs_ticket || "",
    ticket_name: person.ticket_name || "",
    ticket_email: person.ticket_email || "",
    ticket_birth: person.ticket_birth || "",
    ticket_gender: person.ticket_gender || "",
    ticket_nationality: person.ticket_nationality || "",
    ticket_residency: person.ticket_residency || "",
    fee_owed: feeFromStay_(stay),
  };
}

function feeFromStay_(stay) {
  if (stay === "arrange") {
    return 55;
  }
  if (stay === "4" || stay === "5" || stay === "6") {
    return 365;
  }
  return null;
}

function firebaseProblem(error, fallback) {
  var code = error && error.code;
  if (
    code === "auth/invalid-credential" ||
    code === "auth/wrong-password" ||
    code === "auth/user-not-found" ||
    code === "auth/invalid-login-credentials"
  ) {
    return "Wrong email or password.";
  }
  if (code === "auth/email-already-in-use") {
    return "That email is already registered.";
  }
  if (code === "auth/weak-password" || code === "auth/invalid-password") {
    return "Use at least 8 characters.";
  }
  if (code === "auth/invalid-email") {
    return "Enter an email.";
  }
  if (code === "auth/too-many-requests") {
    return "Too many tries. Wait a moment and try again.";
  }
  return fallback;
}
