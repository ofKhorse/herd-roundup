var sessionKey = "herd-roundup-session";
var state = {
  directory: [],
  companions: [],
  memberCode: "",
  admin: false,
  kaptains: [],
  bought: [],
};

var notice = document.querySelector("#notice");
var auth = document.querySelector("#auth");
var profile = document.querySelector("#profile");

document.querySelector("#login-form").addEventListener("submit", onLogin);
document.querySelector("#register-form").addEventListener("submit", onRegister);
document.querySelector("#reset-form").addEventListener("submit", onReset);
document.querySelector("#profile-form").addEventListener("submit", onSave);
document.querySelector("#logout").addEventListener("click", logout);
document.querySelector("#info").addEventListener("toggle", loadInfo);
document.querySelector("#admin-logout").addEventListener("click", logout);
document
  .querySelector("#copy-kaptain-phones")
  .addEventListener("click", function (event) {
    copyPhones(state.kaptains, event.currentTarget);
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
  .addEventListener("change", syncKaptain);

var companionSearch = document.querySelector("#companion-search");
var matchesOpen = false;
companionSearch.addEventListener("focus", function () {
  matchesOpen = true;
  renderMatches();
});
companionSearch.addEventListener("input", renderMatches);
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
  }
});

var saved = readSession();
if (saved && (saved.token || (saved.email && saved.password))) {
  signIn(saved, true);
}

function onLogin(event) {
  event.preventDefault();
  var data = new FormData(event.target);
  signIn({ email: data.get("email"), password: data.get("password") }, false);
}

function signIn(credentials, fromCookie) {
  var body = { action: "login" };
  if (credentials.token) {
    body.token = credentials.token;
  } else {
    body.email = credentials.email;
    body.password = credentials.password;
  }
  callServer(body, {
    pending: "Signing in…",
    success: fromCookie ? "" : "Signed in.",
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
      success: "Your password was emailed to you. Then log in.",
    },
  );
}

function onReset(event) {
  event.preventDefault();
  var data = new FormData(event.target);
  callServer(
    { action: "reset", email: data.get("email") },
    {
      pending: "Sending a new password…",
      success: "A new password was emailed to you.",
    },
  );
}

function onSave(event) {
  event.preventDefault();
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
    boomer_id: data.get("boomer_id"),
    purchased: data.get("purchased") ? "yes" : "",
    purchased_size: data.get("purchased_size"),
    whatsapp: data.get("whatsapp"),
    share_with: state.companions,
    sale_available: data.get("sale_available") === "yes" ? "yes" : "",
    kaptain: data.get("kaptain") === "yes" ? "yes" : "",
  };
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
  callServer(body, { pending: "Saving…", success: "Saved." }).then(
    function (result) {
      if (!result.ok) {
        if (result.field) {
          showFieldErrors([{ field: result.field, error: result.error }]);
        }
        return;
      }
      showSession(result);
    },
  );
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
  document.querySelector("#member-code").textContent =
    result.person.member_code;
  document.querySelector("#fee").textContent =
    result.person.camp_fee_paid === "yes"
      ? "Kamp fee marked paid."
      : "Kamp fee not marked paid yet.";
  var feeOwed = result.person.fee_owed;
  var recorded = Number(result.person.amount) || 0;
  var feeOwedEl = document.querySelector("#fee-owed");
  var feeSummaryEl = document.querySelector("#fee-summary");
  if (feeOwed != null) {
    feeOwedEl.textContent =
      "You owe " +
      feeOwed +
      " EUR. We recorded " +
      recorded +
      " EUR. As we have to manually import payment records this can be outdated!";
    feeSummaryEl.textContent =
      "You owe " +
      feeOwed +
      " EUR. We recorded " +
      recorded +
      " EUR. As we have to manually import payment records this can be outdated!";
  } else {
    feeOwedEl.textContent = "Choose whether you kamp with us to see your fee.";
    feeSummaryEl.textContent = "";
  }
  document.querySelector("#tipi-count").textContent =
    result.tipi_count + " tipis marked as bought.";
  var form = document.querySelector("#profile-form");
  form.full_name.value = result.person.full_name;
  restoreStay(result.person.stay);
  form.boomer_id.value = result.person.boomer_id;
  form.whatsapp.value = showWhatsapp(result.person.whatsapp);
  form.purchased.checked = result.person.purchased === "yes";
  form.purchased_size.value = result.person.purchased_size;
  form.sale_available.value = result.person.sale_available || "";
  form.kaptain.value = result.person.kaptain || "";
  syncKaptain();
  renderCompanions();
  renderMatches();
  renderPickedBy();
  renderMembers(result);
  showView();
}

function syncKaptain() {
  var available = document.querySelector("[name=sale_available]").value;
  document.querySelector("#kaptain-row").hidden = available !== "yes";
  if (available !== "yes") {
    document.querySelector("[name=kaptain]").value = "";
  }
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
    var haystack = (person.full_name + " " + person.member_code).toLowerCase();
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
      renderCompanions();
      renderMatches();
    });
    box.appendChild(button);
  });
  if (query && !matches.length && state.companions.indexOf(query) === -1) {
    var addButton = document.createElement("button");
    addButton.type = "button";
    addButton.textContent = 'Add "' + query + '"';
    addButton.addEventListener("mousedown", function (event) {
      event.preventDefault();
    });
    addButton.addEventListener("click", function () {
      state.companions.push(query);
      companionSearch.value = "";
      renderCompanions();
      renderMatches();
    });
    box.appendChild(addButton);
  } else if (!query && !matches.length) {
    var empty = document.createElement("p");
    empty.className = "no-match";
    empty.textContent = "No match found";
    box.appendChild(empty);
  }
}

function renderPickedBy() {
  var box = document.querySelector("#picked-by");
  var names = state.directory
    .filter(function (person) {
      return (person.share_with || []).indexOf(state.memberCode) !== -1;
    })
    .map(function (person) {
      return person.full_name || person.member_code;
    });
  box.textContent = names.length ? names.join(", ") : "Nobody yet.";
}

function showView() {
  var onAdmin =
    state.admin &&
    (location.hash === "#admin" || location.hash === "#payments");
  document.querySelector("#nav").hidden = !state.admin;
  profile.hidden = !state.memberCode || onAdmin;
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
    ["4", "4 people (5-person tent)"],
    ["5", "5 people (Star Tent)"],
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
    ["star5", "Star Tent, up to 5 people"],
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
  state.bought = [];
  renderPeopleRows("#kaptain-rows", [], 3);
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
      ["Boomer ID", member.boomer_id],
      ["Sleeping", memberStay(member.stay)],
      ["At sale", memberYes(member.sale_available)],
      ["Potential Kaptain", memberYes(member.kaptain)],
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
  state.bought = people.filter(function (member) {
    return member.purchased === "yes";
  });
  renderPeopleRows("#kaptain-rows", state.kaptains, 3, function (member) {
    return [member.full_name, member.member_code, member.whatsapp];
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
      star5: "Star Tent, up to 5 people",
      tipi6: "Tipi, up to 6 people",
    }[size] || ""
  );
}

function memberYes(value) {
  return value === "yes" ? "Yes" : "";
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
  if (!person || !person.full_name) {
    return code;
  }
  return person.full_name + " (" + code + ")";
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
    "; Max-Age=2592000; Path=/herd-roundup; SameSite=Lax; Secure";
}

function clearSession() {
  document.cookie =
    sessionKey + "=; Max-Age=0; Path=/herd-roundup; SameSite=Lax; Secure";
}

function logout() {
  clearSession();
  state.memberCode = "";
  state.admin = false;
  if (location.hash) {
    history.replaceState(null, "", location.pathname + location.search);
  }
  profile.hidden = true;
  document.querySelector("#admin").hidden = true;
  document.querySelector("#nav").hidden = true;
  auth.hidden = false;
  say("Logged out.");
}

var serverBusy = false;

function callServer(body, options) {
  if (serverBusy) {
    return Promise.resolve({ ok: false, skipped: true });
  }
  serverBusy = true;
  options = options || {};
  showBusy(options.pending || "Working…");
  return post(body)
    .then(function (result) {
      if (!result.ok) {
        return finishBusy(result.error || "Something went wrong.").then(
          function () {
            return result;
          },
        );
      }
      if (!options.success) {
        hideBusy();
        return result;
      }
      return finishBusy(options.success).then(function () {
        return result;
      });
    })
    .catch(function (error) {
      var message = error.message || "The request failed.";
      return finishBusy(message).then(function () {
        return { ok: false, error: message };
      });
    })
    .then(function (result) {
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
  }).then(function (response) {
    return response.json();
  });
}

function showBusy(message) {
  document.querySelector("main").inert = true;
  document.querySelector("#busy-spinner").hidden = false;
  document.querySelector("#busy-ok").hidden = true;
  document.querySelector("#busy-message").textContent = message;
  var busy = document.querySelector("#busy");
  busy.hidden = false;
  document.querySelector(".busy-card").focus();
}

function hideBusy() {
  document.querySelector("#busy").hidden = true;
  document.querySelector("main").inert = false;
}

function finishBusy(message) {
  document.querySelector("#busy-spinner").hidden = true;
  document.querySelector("#busy-message").textContent = message;
  var ok = document.querySelector("#busy-ok");
  ok.hidden = false;
  ok.focus();
  return new Promise(function (resolve) {
    ok.onclick = function () {
      ok.onclick = null;
      hideBusy();
      resolve();
    };
  });
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
      frame.srcdoc = html.replace(
        "</head>",
        "<style>body{padding:16px !important;max-width:none !important}</style></head>",
      );
      status.hidden = true;
    })
    .catch(function (error) {
      info.dataset.loaded = "";
      status.textContent = error.message || "The info doc could not be loaded.";
    });
}

function openInfoOnce(memberCode) {
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
