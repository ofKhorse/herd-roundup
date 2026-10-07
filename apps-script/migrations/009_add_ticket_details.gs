function migration009AddTicketDetails_(ss) {
  var sheet = sheetFor_(ss, "people");
  appendHeader_(sheet, "ticket_email");
  appendHeader_(sheet, "ticket_birth");
  appendHeader_(sheet, "ticket_gender");
  appendHeader_(sheet, "ticket_nationality");
  appendHeader_(sheet, "ticket_residency");
}
