function memberEditDetail(member, columns, paidText) {
  var detail = document.createElement("tr");
  detail.className = "member-detail";
  var cell = document.createElement("td");
  cell.colSpan = columns;
  cell.appendChild(memberEditForm(member, paidText));
  detail.appendChild(cell);
  return detail;
}

function memberEditForm(member, paidText) {
  var stay = stayParts_(member.stay);
  var mates = (member.share_with || []).slice();
  var form = document.createElement("form");
  form.className = "member-box member-edit";
  form.appendChild(readOnlyLine_("Kode", member.member_code));
  form.appendChild(readOnlyLine_("Email", member.email));
  form.appendChild(textField_("full_name", "Full name", member.full_name));
  form.appendChild(
    textField_(
      "boomer_email",
      "Email you used registering for boom",
      member.boomer_email,
      "email",
    ),
  );
  form.appendChild(textField_("whatsapp", "WhatsApp", member.whatsapp, "tel"));
  var village = selectField_(
    "village",
    "Will you kamp in the tipi village with us?",
    [
      ["", "Choose later"],
      ["yes", "Yes"],
      ["arrange", "I arrange myself"],
    ],
    stay.village,
  );
  var sizeRow = document.createElement("div");
  sizeRow.hidden = stay.village !== "yes";
  sizeRow.appendChild(
    selectField_(
      "size",
      "Preferred size",
      [
        ["", "Choose later"],
        ["4", "4 people"],
        ["5", "5 people"],
        ["6", "6 people"],
      ],
      stay.size,
    ),
  );
  form.appendChild(village);
  form.appendChild(sizeRow);
  form.appendChild(mateEditor_(mates, member.member_code));
  var sale = selectField_(
    "sale_available",
    "Will you be available during the sale?",
    [
      ["", "Choose later"],
      ["yes", "Yes"],
      ["no", "No"],
    ],
    member.sale_available === "yes" || member.sale_available === "no"
      ? member.sale_available
      : "",
  );
  var kaptainRow = document.createElement("div");
  kaptainRow.hidden = member.sale_available !== "yes";
  kaptainRow.appendChild(
    selectField_(
      "kaptain",
      "Kan you be a tipi Kaptain?",
      [
        ["", "Choose later"],
        ["yes", "Yes"],
        ["no", "No"],
      ],
      member.kaptain === "yes" ? "yes" : "",
    ),
  );
  var ticketRow = document.createElement("div");
  ticketRow.hidden = member.sale_available !== "no";
  var ask = document.createElement("label");
  ask.className = "row";
  var askBox = document.createElement("input");
  askBox.type = "checkbox";
  askBox.name = "needs_ticket";
  askBox.checked = member.needs_ticket === "yes";
  ask.appendChild(askBox);
  ask.appendChild(
    document.createTextNode(" I need someone to buy a ticket for me."),
  );
  var ticketFields = document.createElement("div");
  ticketFields.hidden = member.needs_ticket !== "yes";
  ticketFields.appendChild(
    textField_("ticket_name", "Name", member.ticket_name),
  );
  ticketFields.appendChild(
    textField_("ticket_email", "Email", member.ticket_email, "email"),
  );
  ticketFields.appendChild(
    textField_("ticket_birth", "Date of birth", member.ticket_birth, "date"),
  );
  ticketFields.appendChild(
    selectField_(
      "ticket_gender",
      "Gender",
      [
        ["", "Choose one"],
        ["male", "Male"],
        ["female", "Female"],
        ["other", "Other"],
      ],
      member.ticket_gender || "",
    ),
  );
  ticketFields.appendChild(
    textField_("ticket_nationality", "Nationality", member.ticket_nationality),
  );
  ticketFields.appendChild(
    textField_("ticket_residency", "Residency", member.ticket_residency),
  );
  ticketRow.appendChild(ask);
  ticketRow.appendChild(ticketFields);
  form.appendChild(sale);
  form.appendChild(kaptainRow);
  form.appendChild(ticketRow);
  var bought = document.createElement("label");
  bought.className = "row";
  var boughtBox = document.createElement("input");
  boughtBox.type = "checkbox";
  boughtBox.name = "purchased";
  boughtBox.checked = member.purchased === "yes";
  bought.appendChild(boughtBox);
  bought.appendChild(document.createTextNode(" I bought one"));
  form.appendChild(bought);
  form.appendChild(
    selectField_(
      "purchased_size",
      "Which one",
      [
        ["", "Choose one"],
        ["tipi2", "Tipi, up to 2 people"],
        ["star2", "Star Tent, up to 2 people"],
        ["star5", "5-Star Tent, up to 5 people"],
        ["tipi6", "Tipi, up to 6 people"],
      ],
      member.purchased_size || "",
    ),
  );
  form.appendChild(
    readOnlyLine_(
      "Owes",
      member.fee_owed == null ? "" : String(member.fee_owed),
    ),
  );
  form.appendChild(readOnlyLine_("Paid", paidText || ""));
  form.appendChild(readOnlyLine_("Reference", member.payment_ref));
  var error = document.createElement("p");
  error.className = "member-edit-error";
  error.hidden = true;
  form.appendChild(error);
  var save = document.createElement("button");
  save.className = "solid";
  save.type = "submit";
  save.textContent = "Save";
  form.appendChild(save);
  village.querySelector("select").addEventListener("change", function () {
    sizeRow.hidden = village.querySelector("select").value !== "yes";
  });
  sale.querySelector("select").addEventListener("change", function () {
    var value = sale.querySelector("select").value;
    kaptainRow.hidden = value !== "yes";
    ticketRow.hidden = value !== "no";
  });
  askBox.addEventListener("change", function () {
    ticketFields.hidden = !askBox.checked;
  });
  form.addEventListener("submit", function (event) {
    event.preventDefault();
    saveAdminMember_(member, form, mates, error);
  });
  return form;
}

function saveAdminMember_(member, form, mates, error) {
  var village = form.village.value;
  var size = form.size.value;
  if (village === "yes" && size !== "4" && size !== "5" && size !== "6") {
    showEditError_(error, "Choose how many people will sleep in the tent.");
    return;
  }
  var phoneError = whatsappProblem(form.whatsapp.value);
  if (phoneError) {
    showEditError_(error, phoneError);
    return;
  }
  var draft = adminDraft_(form, mates);
  var problems = editableProfileProblems(draft, member.member_code);
  if (problems.length) {
    showEditError_(error, problems[0].error);
    return;
  }
  error.hidden = true;
  var user = firebase.auth().currentUser;
  if (!user) {
    showEditError_(error, "Log in again.");
    return;
  }
  showBusy("Saving…");
  var personRef = firebase.firestore().collection("people").doc(member.uid);
  var now = new Date().toISOString();
  firebase
    .firestore()
    .runTransaction(function (tx) {
      return tx.get(personRef).then(function (snap) {
        if (!snap.exists) {
          throw new Error("missing");
        }
        var current = snap.data();
        var written = peopleWrite(draft, {
          member_code: current.member_code,
          email: current.email,
          admin: current.admin,
          camp_fee_paid: current.camp_fee_paid || "",
          amount: current.amount || "",
          payment_ref: current.payment_ref || "",
          purchased_at: purchasedAtFor(current, draft.purchased, now),
        });
        tx.update(personRef, written);
        return written;
      });
    })
    .then(function (written) {
      return writeDirectory_({ uid: member.uid }, written).then(
        function () {
          return true;
        },
        function () {
          return false;
        },
      );
    })
    .then(function (listed) {
      return loadFirebaseProfile(user).then(function (result) {
        hideBusy();
        if (!result.ok) {
          say(result.error);
          return;
        }
        showSession(result);
        toast(
          listed
            ? "Saved."
            : "Saved. The herd list did not update. Save again.",
          !listed,
        );
      });
    })
    .catch(function () {
      hideBusy();
      showEditError_(error, "Saving failed.");
    });
}

function adminDraft_(form, mates) {
  var village = form.village.value;
  var stay =
    village === "arrange"
      ? "arrange"
      : village === "yes"
        ? form.size.value
        : "";
  var sale = form.sale_available.value;
  if (sale !== "yes" && sale !== "no") {
    sale = "";
  }
  var needs = sale === "no" && form.needs_ticket.checked;
  return {
    full_name: form.full_name.value.trim(),
    stay: stay,
    boomer_email: form.boomer_email.value.trim(),
    purchased: form.purchased.checked ? "yes" : "",
    purchased_size: form.purchased_size.value,
    whatsapp: storedWhatsapp(form.whatsapp.value),
    share_with: mates.slice(),
    sale_available: sale,
    kaptain: form.kaptain.value === "yes" ? "yes" : "",
    needs_ticket: needs ? "yes" : "",
    ticket_name: needs ? form.ticket_name.value.trim() : "",
    ticket_email: needs ? form.ticket_email.value.trim() : "",
    ticket_birth: needs ? form.ticket_birth.value : "",
    ticket_gender: needs ? form.ticket_gender.value : "",
    ticket_nationality: needs ? form.ticket_nationality.value.trim() : "",
    ticket_residency: needs ? form.ticket_residency.value.trim() : "",
  };
}
