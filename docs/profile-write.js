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
