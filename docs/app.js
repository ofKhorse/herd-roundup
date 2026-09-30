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
  var button = document.querySelector("#login-form button");
  button.disabled = true;
  setLoading("Signing in…");
  var body = { action: "login" };
  if (credentials.token) {
    body.token = credentials.token;
  } else {
    body.email = credentials.email;
    body.password = credentials.password;
  }
  post(body)
    .then(function (result) {
      setLoading("");
      if (!result.ok) {
        if (fromCookie) {
          clearSession();
        }
        say(result.error);
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
    })
    .catch(fail)
    .then(function () {
      button.disabled = false;
    });
}

function onRegister(event) {
  event.preventDefault();
  var data = new FormData(event.target);
  post({
    action: "register",
    email: data.get("email"),
    whatsapp: data.get("whatsapp"),
  })
    .then(function (result) {
      if (!result.ok) {
        say(result.error);
        return;
      }
      say("Your password was emailed to you. Then log in.");
    })
    .catch(fail);
}

function onReset(event) {
  event.preventDefault();
  var data = new FormData(event.target);
  post({ action: "reset", email: data.get("email") })
    .then(function (result) {
      if (!result.ok) {
        say(result.error);
        return;
      }
      say("A new password was emailed to you.");
    })
    .catch(fail);
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
  post(body)
    .then(function (result) {
      if (!result.ok) {
        say(result.error);
        return;
      }
      showSession(result);
      say("Saved.");
    })
    .catch(fail);
}

function showSession(result) {
  if (!result.ok) {
    say(result.error);
    return;
  }
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
      "You owe " + feeOwed + " EUR. We recorded " + recorded + " EUR. As we have to manually import payment records this can be outdated!";
    feeSummaryEl.textContent =
      "You owe " + feeOwed + " EUR. We recorded " + recorded + " EUR. As we have to manually import payment records this can be outdated!";
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
  } else if (stay === "2" || stay === "4" || stay === "5" || stay === "6") {
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

function fail(error) {
  say(error.message);
}

function setLoading(message) {
  notice.classList.toggle("loading", message !== "");
  if (message) {
    notice.textContent = message;
  }
}

function say(message) {
  notice.classList.remove("loading");
  notice.textContent = message;
  if (message) {
    alert(message);
  }
}
