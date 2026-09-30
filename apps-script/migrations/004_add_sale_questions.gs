function migration004AddSaleQuestions_(ss) {
  appendHeader_(sheetFor_(ss, "people"), "sale_available");
  appendHeader_(sheetFor_(ss, "people"), "kaptain");
}
