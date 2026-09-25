var sessionKey = "herd-roundup-session";
var state = { directory: [], companions: [], memberCode: "" };

var notice = document.querySelector("#notice");
var auth = document.querySelector("#auth");
var profile = document.querySelector("#profile");

document.querySelector("#login-form").addEventListener("submit", onLogin);
document.querySelector("#register-form").addEventListener("submit", onRegister);
document.querySelector("#reset-form").addEventListener("submit", onReset);
document.querySelector("#profile-form").addEventListener("submit", onSave);
document.querySelector("#logout").addEventListener("click", logout);
document
  .querySelector("#companion-search")
  .addEventListener("input", renderMatches);

var saved = sessionStorage.getItem(sessionKey);
if (saved) {
  var credentials = JSON.parse(saved);
  post({
    action: "login",
    email: credentials.email,
    password: credentials.password,
  })
    .then(showSession)
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
      sessionStorage.setItem(
        sessionKey,
        JSON.stringify({
          email: data.get("email"),
          password: data.get("password"),
        }),
      );
      showSession(result);
    })
    .catch(fail);
}

function onRegister(event) {
  event.preventDefault();
  var data = new FormData(event.target);
  post({ action: "register", email: data.get("email") })
    .then(function (result) {
      if (!result.ok) {
        say(result.error);
        return;
      }
      say("Your password is " + result.password + ". Save it, then log in.");
    })
    .catch(fail);
}

function onReset(event) {
  event.preventDefault();
  var data = new FormData(event.target);
  post({ action: "reset", email: data.get("email") })
    .then(function (result) {
      say(result.ok ? "A new password was emailed to you." : result.error);
    })
    .catch(fail);
}

function onSave(event) {
  event.preventDefault();
  var credentials = JSON.parse(sessionStorage.getItem(sessionKey));
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
    share_with: state.companions,
  })
    .then(function (result) {
      if (!result.ok) {
        say(result.error);
        return;
      }
      say("Saved.");
      showSession(result);
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
  profile.hidden = false;
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
  form.purchased.checked = result.person.purchased === "yes";
  form.purchased_size.value = result.person.purchased_size;
  renderCompanions();
  renderMatches();
  renderPickedBy();
  renderPayments(result);
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
  var query = document
    .querySelector("#companion-search")
    .value.trim()
    .toLowerCase();
  var box = document.querySelector("#companion-matches");
  box.innerHTML = "";
  if (!query) {
    return;
  }
  state.directory
    .filter(function (person) {
      if (state.companions.indexOf(person.member_code) !== -1) {
        return false;
      }
      var haystack = (
        person.full_name +
        " " +
        person.member_code
      ).toLowerCase();
      return haystack.indexOf(query) !== -1;
    })
    .forEach(function (person) {
      var button = document.createElement("button");
      button.type = "button";
      button.textContent = labelFor(person.member_code);
      button.addEventListener("click", function () {
        state.companions.push(person.member_code);
        document.querySelector("#companion-search").value = "";
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

function renderPayments(result) {
  var section = document.querySelector("#payments");
  var body = document.querySelector("#payment-rows");
  body.innerHTML = "";
  if (result.person.admin !== "yes") {
    section.hidden = true;
    return;
  }
  section.hidden = false;
  result.payments.forEach(function (payment) {
    var row = document.createElement("tr");
    [
      payment.full_name,
      payment.member_code,
      payment.amount,
      payment.payment_ref,
      payment.camp_fee_paid,
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

function logout() {
  sessionStorage.removeItem(sessionKey);
  profile.hidden = true;
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
}
