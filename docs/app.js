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
if (saved) {
  post({
    action: "login",
    email: saved.email,
    password: saved.password,
  })
    .then(function (result) {
      if (!result.ok) {
        clearSession();
        say(result.error);
        return;
      }
      showSession(result);
    })
    .catch(function (error) {
      say(error.message);
    });
}

function onLogin(event) {
  event.preventDefault();
  var data = new FormData(event.target);
  post({
    action: "login",
    email: data.get("email"),
    password: data.get("password"),
  })
    .then(function (result) {
      if (!result.ok) {
        say(result.error);
        return;
      }
      writeSession(data.get("email"), data.get("password"));
      showSession(result);
    })
    .catch(fail);
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
  if (!credentials) {
    say("Log in again.");
    return;
  }
  var data = new FormData(event.target);
  post({
    action: "save",
    email: credentials.email,
    password: credentials.password,
    full_name: data.get("full_name"),
    stay: data.get("stay"),
    boomer_id: data.get("boomer_id"),
    purchased: data.get("purchased") ? "yes" : "",
    purchased_size: data.get("purchased_size"),
    whatsapp: data.get("whatsapp"),
    share_with: state.companions,
  })
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
      ? "Camp fee marked paid."
      : "Camp fee not marked paid yet.";
  document.querySelector("#tipi-count").textContent =
    result.tipi_count + " tipis marked as bought.";
  var form = document.querySelector("#profile-form");
  form.full_name.value = result.person.full_name;
  form.stay.value = result.person.stay;
  form.boomer_id.value = result.person.boomer_id;
  form.whatsapp.value = result.person.whatsapp || "";
  form.purchased.checked = result.person.purchased === "yes";
  form.purchased_size.value = result.person.purchased_size;
  renderCompanions();
  renderMatches();
  renderPickedBy();
  renderPayments(result);
  showView();
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
  var query = companionSearch.value.trim().toLowerCase();
  var matches = state.directory.filter(function (person) {
    if (state.companions.indexOf(person.member_code) !== -1) {
      return false;
    }
    if (!query) {
      return true;
    }
    var haystack = (person.full_name + " " + person.member_code).toLowerCase();
    return haystack.indexOf(query) !== -1;
  });
  if (!matches.length) {
    var empty = document.createElement("p");
    empty.className = "no-match";
    empty.textContent = "No match found";
    box.appendChild(empty);
    return;
  }
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

function renderTipiBySize(counts) {
  var box = document.querySelector("#tipi-by-size");
  box.innerHTML = "";
  [
    ["2", "2-person"],
    ["4", "4-person"],
    ["5", "5-person"],
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

function writeSession(email, password) {
  document.cookie =
    sessionKey +
    "=" +
    encodeURIComponent(JSON.stringify({ email: email, password: password })) +
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

function say(message) {
  notice.textContent = message;
  if (message) {
    alert(message);
  }
}
