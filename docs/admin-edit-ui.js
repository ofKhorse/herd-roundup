function mateEditor_(mates, memberCode) {
  var box = document.createElement("div");
  var heading = document.createElement("p");
  heading.className = "member-label";
  heading.textContent = "Stable mates";
  var list = document.createElement("ol");
  var search = document.createElement("input");
  search.placeholder = "Name or kode";
  var add = document.createElement("button");
  add.type = "button";
  add.className = "solid";
  add.textContent = "Add unregistered";
  add.disabled = true;
  var matches = document.createElement("div");
  matches.className = "member-matches";
  function paint() {
    list.innerHTML = "";
    mates.forEach(function (code, index) {
      var item = document.createElement("li");
      item.className = "person";
      var name = document.createElement("span");
      name.textContent = labelFor(code);
      var remove = document.createElement("button");
      remove.type = "button";
      remove.textContent = "Remove";
      remove.addEventListener("click", function () {
        mates.splice(index, 1);
        paint();
      });
      item.appendChild(name);
      item.appendChild(remove);
      list.appendChild(item);
    });
  }
  function showMatches() {
    matches.innerHTML = "";
    var query = search.value.trim().toLowerCase();
    if (!query) {
      return;
    }
    state.directory.forEach(function (person) {
      if (
        person.member_code === memberCode ||
        mates.indexOf(person.member_code) !== -1
      ) {
        return;
      }
      var haystack = (
        person.full_name +
        " " +
        person.member_code +
        " " +
        (person.email || "")
      ).toLowerCase();
      if (haystack.indexOf(query) === -1) {
        return;
      }
      var button = document.createElement("button");
      button.type = "button";
      button.textContent = labelFor(person.member_code);
      button.addEventListener("click", function () {
        mates.push(person.member_code);
        search.value = "";
        add.disabled = true;
        matches.innerHTML = "";
        paint();
      });
      matches.appendChild(button);
    });
  }
  search.addEventListener("keydown", function (event) {
    if (event.key === "Enter") {
      event.preventDefault();
    }
  });
  search.addEventListener("input", function () {
    add.disabled = !search.value.trim();
    showMatches();
  });
  add.addEventListener("click", function () {
    var query = search.value.trim();
    if (query && mates.indexOf(query) === -1) {
      mates.push(query);
      paint();
    }
    search.value = "";
    add.disabled = true;
    matches.innerHTML = "";
  });
  var addRow = document.createElement("div");
  addRow.className = "companion-add";
  var searchLabel = document.createElement("label");
  searchLabel.appendChild(document.createTextNode("Add someone"));
  searchLabel.appendChild(search);
  addRow.appendChild(searchLabel);
  addRow.appendChild(add);
  box.appendChild(heading);
  box.appendChild(list);
  box.appendChild(addRow);
  box.appendChild(matches);
  paint();
  return box;
}

function stayParts_(stay) {
  if (stay === "arrange") {
    return { village: "arrange", size: "" };
  }
  if (stay === "4" || stay === "5" || stay === "6") {
    return { village: "yes", size: stay };
  }
  return { village: "", size: "" };
}

function readOnlyLine_(labelText, value) {
  var line = document.createElement("p");
  var label = document.createElement("span");
  label.className = "member-label";
  label.textContent = labelText;
  line.appendChild(label);
  line.appendChild(document.createTextNode(value || "—"));
  return line;
}

function textField_(name, labelText, value, type) {
  var label = document.createElement("label");
  label.appendChild(document.createTextNode(labelText));
  var input = document.createElement("input");
  input.name = name;
  input.type = type || "text";
  input.value = value || "";
  label.appendChild(input);
  return label;
}

function selectField_(name, labelText, options, value) {
  var label = document.createElement("label");
  label.appendChild(document.createTextNode(labelText));
  var select = document.createElement("select");
  select.name = name;
  options.forEach(function (pair) {
    var option = document.createElement("option");
    option.value = pair[0];
    option.textContent = pair[1];
    select.appendChild(option);
  });
  select.value = value || "";
  label.appendChild(select);
  return label;
}

function showEditError_(error, message) {
  error.hidden = false;
  error.textContent = message;
}
