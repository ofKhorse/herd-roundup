var sessionKey = "herd-roundup-session";
var state = { directory: [], companions: [], memberCode: "", admin: false };

var notice = document.querySelector("#notice");
var auth = document.querySelector("#auth");
var profile = document.querySelector("#profile");

document.querySelector("#login-form").addEventListener("submit", onLogin);
document.querySelector("#register-form").addEventListener("submit", onRegister);
document.querySelector("#reset-form").addEventListener("submit", onReset);
document.querySelector("#profile-form").addEventListener("submit", onSave);
document.querySelector("#logout").addEventListener("click", logout);
document.querySelector("#admin-logout").addEventListener("click", logout);
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
  form.whatsapp.value = result.person.whatsapp || "";
  form.purchased.checked = result.person.purchased === "yes";
  form.purchased_size.value = result.person.purchased_size;
  form.sale_available.value = result.person.sale_available || "";
  form.kaptain.value = result.person.kaptain || "";
  syncKaptain();
  renderCompanions();
  renderMatches();
  renderPickedBy();
  renderPayments(result);
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

function renderPayments(result) {
  var body = document.querySelector("#payment-rows");
  body.innerHTML = "";
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
  result.payments.forEach(function (payment) {
    var row = document.createElement("tr");
    [
      payment.full_name,
      payment.member_code,
      payment.amount,
      payment.payment_ref,
      payment.camp_fee_paid,
      payment.whatsapp,
    ].forEach(function (value) {
      var cell = document.createElement("td");
      cell.textContent = value || "";
      row.appendChild(cell);
    });
    body.appendChild(row);
  });
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

function profileProblems() {
  var form = document.querySelector("#profile-form");
  var problems = [];
  var digits = String(form.whatsapp.value || "")
    .trim()
    .replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 15) {
    problems.push({ field: "whatsapp", error: "Enter a WhatsApp number." });
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
