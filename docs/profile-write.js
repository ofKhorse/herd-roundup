function memberCodeFromNumber(number) {
  if (number < 10) {
    return "KH-00" + number;
  }
  if (number < 100) {
    return "KH-0" + number;
  }
  return "KH-" + number;
}

function storedWhatsapp(value) {
  var number = String(value || "").trim();
  var digits = number.replace(/\D/g, "");
  if (number.charAt(0) === "+" && digits.length >= 8 && digits.length <= 15) {
    return "+" + digits;
  }
  return number;
}

function purchasedAtFor(current, purchased, now) {
  if (purchased !== "yes") {
    return "";
  }
  if (current && current.purchased === "yes" && current.purchased_at) {
    return current.purchased_at;
  }
  return now;
}

function directoryEntry(person) {
  return {
    member_code: person.member_code,
    full_name: person.full_name,
    email: person.full_name ? "" : person.email,
    share_with: person.share_with.slice(),
  };
}

function peopleWrite(draft, kept) {
  var ticket = blankTicketFields();
  if (draft.sale_available === "no" && draft.needs_ticket === "yes") {
    ticket = {
      needs_ticket: "yes",
      ticket_name: draft.ticket_name,
      ticket_email: draft.ticket_email,
      ticket_birth: draft.ticket_birth,
      ticket_gender: draft.ticket_gender,
      ticket_nationality: draft.ticket_nationality,
      ticket_residency: draft.ticket_residency,
    };
  }
  return {
    member_code: kept.member_code,
    email: kept.email,
    admin: kept.admin,
    full_name: draft.full_name,
    stay: draft.stay,
    purchased: draft.purchased,
    purchased_size: draft.purchased === "yes" ? draft.purchased_size : "",
    purchased_at: kept.purchased_at,
    boomer_email: draft.boomer_email,
    share_with: draft.share_with.slice(),
    camp_fee_paid: kept.camp_fee_paid,
    amount: kept.amount,
    payment_ref: kept.payment_ref,
    whatsapp: draft.whatsapp,
    sale_available: draft.sale_available,
    kaptain:
      draft.sale_available === "yes" && draft.kaptain === "yes" ? "yes" : "",
    needs_ticket: ticket.needs_ticket,
    ticket_name: ticket.ticket_name,
    ticket_email: ticket.ticket_email,
    ticket_birth: ticket.ticket_birth,
    ticket_gender: ticket.ticket_gender,
    ticket_nationality: ticket.ticket_nationality,
    ticket_residency: ticket.ticket_residency,
  };
}

function blankTicketFields() {
  return {
    needs_ticket: "",
    ticket_name: "",
    ticket_email: "",
    ticket_birth: "",
    ticket_gender: "",
    ticket_nationality: "",
    ticket_residency: "",
  };
}

function editableProfileProblems(draft, memberCode) {
  var problems = draftProblems(draft);
  if (!draft.whatsapp) {
    problems.push({ field: "whatsapp", error: "Enter a WhatsApp number." });
  }
  if (draft.purchased === "yes" && !draft.purchased_size) {
    problems.push({
      field: "purchased_size",
      error: "Choose which tent or tipi you bought.",
    });
  }
  if (draft.purchased !== "yes" && draft.purchased_size) {
    problems.push({
      field: "purchased",
      error:
        "Tick I bought a tipi at the official BOOM sale, or clear which tent or tipi you chose.",
    });
  }
  if (draft.sale_available === "no" && draft.needs_ticket === "yes") {
    if (!draft.ticket_name) {
      problems.push({ field: "ticket_name", error: "Enter the name." });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.ticket_email)) {
      problems.push({ field: "ticket_email", error: "Enter an email." });
    }
    if (!draft.ticket_birth) {
      problems.push({ field: "ticket_birth", error: "Enter a date of birth." });
    }
    if (
      draft.ticket_gender !== "male" &&
      draft.ticket_gender !== "female" &&
      draft.ticket_gender !== "other"
    ) {
      problems.push({
        field: "ticket_gender",
        error: "Choose male, female, or other.",
      });
    }
    if (!draft.ticket_nationality) {
      problems.push({
        field: "ticket_nationality",
        error: "Enter a nationality.",
      });
    }
    if (!draft.ticket_residency) {
      problems.push({ field: "ticket_residency", error: "Enter a residency." });
    }
  }
  if (
    draft.share_with.length > 0 &&
    draft.stay !== "4" &&
    draft.stay !== "5" &&
    draft.stay !== "6"
  ) {
    problems.push({
      field: "share_with",
      error:
        draft.stay === "arrange"
          ? "You kan add people only when you choose a tent or a tipi."
          : "Choose a sleeping preference before adding people.",
    });
  }
  var seen = {};
  for (var i = 0; i < draft.share_with.length; i++) {
    var code = draft.share_with[i];
    if (code === memberCode) {
      problems.push({ field: "share_with", error: "You kan't list yourself." });
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
  return problems;
}

function draftProblems(draft) {
  var problems = [];
  if (draft.full_name.length >= 200) {
    problems.push({ field: "full_name", error: "Use a shorter name." });
  }
  if (
    draft.boomer_email &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.boomer_email)
  ) {
    problems.push({
      field: "boomer_email",
      error: "Enter the email you used registering for boom.",
    });
  }
  if (draft.share_with.length > 12) {
    problems.push({ field: "share_with", error: "List at most 12 people." });
  }
  for (var i = 0; i < draft.share_with.length; i++) {
    if (draft.share_with[i].length >= 80) {
      problems.push({ field: "share_with", error: "Use a shorter name." });
      break;
    }
  }
  if (draft.whatsapp && !/^\+[0-9]{8,15}$/.test(draft.whatsapp)) {
    problems.push({ field: "whatsapp", error: "Enter a WhatsApp number." });
  }
  return problems;
}
