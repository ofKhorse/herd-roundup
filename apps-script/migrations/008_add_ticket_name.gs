function migration008AddTicketName_(ss) {
  appendHeader_(sheetFor_(ss, "people"), "needs_ticket");
  appendHeader_(sheetFor_(ss, "people"), "ticket_name");
}
