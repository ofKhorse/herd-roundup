function paymentNameKey(value) {
  var text = String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");
  text = text.replace(/ß/g, "ss").toLowerCase();
  text = text.replace(/['’]/g, "");
  text = text.replace(/[^a-z0-9]+/g, " ").trim();
  return text;
}

function paymentDocId(contributor) {
  var key = paymentNameKey(contributor).replace(/ /g, "-");
  if (!key) {
    return "";
  }
  return key.slice(0, 200);
}

function paymentKode(value) {
  var match = String(value || "")
    .trim()
    .toUpperCase()
    .match(/^KH-0*(\d+)$/);
  if (!match) {
    return "";
  }
  var number = parseInt(match[1], 10);
  if (!number || number > 9999) {
    return "";
  }
  var digits = String(number);
  if (number < 1000) {
    while (digits.length < 3) {
      digits = "0" + digits;
    }
  }
  return "KH-" + digits;
}

function paymentCents(value) {
  if (typeof value === "number") {
    if (!isFinite(value)) {
      return null;
    }
    return Math.round(value * 100);
  }
  var text = String(value || "")
    .trim()
    .replace(/€/g, "")
    .replace(/\s/g, "");
  if (!text) {
    return null;
  }
  if (text.indexOf(".") !== -1 && text.indexOf(",") !== -1) {
    text = text.replace(/,/g, "");
  } else if (text.indexOf(",") !== -1) {
    var parts = text.split(",");
    if (parts.length === 2 && parts[1].length === 3) {
      text = parts[0] + parts[1];
    } else {
      text = text.replace(/,/g, ".");
    }
  }
  if (!/^-?\d+(\.\d+)?$/.test(text)) {
    return null;
  }
  var number = Number(text);
  if (!isFinite(number)) {
    return null;
  }
  return Math.round(number * 100);
}

function paymentAmountText(cents) {
  var negative = cents < 0;
  var abs = Math.abs(Math.round(cents));
  var whole = Math.floor(abs / 100);
  var fraction = abs % 100;
  var text = whole + "." + (fraction < 10 ? "0" : "") + fraction;
  return negative ? "-" + text : text;
}

function paymentFeeCents(stay) {
  if (stay === "arrange") {
    return 5500;
  }
  if (stay === "4" || stay === "5" || stay === "6") {
    return 36500;
  }
  return null;
}

function paymentMemberByKode_(members, kode) {
  for (var i = 0; i < members.length; i++) {
    if (paymentKode(members[i].member_code) === kode) {
      return members[i];
    }
  }
  return null;
}

function paymentMatch(row, members) {
  var list = members || [];
  var payment = row || {};
  var override = paymentKode(payment.override_kode);
  if (override) {
    return {
      how: "override",
      member: paymentMemberByKode_(list, override),
    };
  }
  var sheet = paymentKode(payment.sheet_kode || payment.kode);
  if (sheet) {
    var byKode = paymentMemberByKode_(list, sheet);
    if (byKode) {
      return { how: "kode", member: byKode };
    }
  }
  var key = paymentNameKey(payment.contributor);
  if (!key) {
    return { how: "", member: null };
  }
  var named = [];
  for (var i = 0; i < list.length; i++) {
    if (paymentNameKey(list[i].full_name) === key) {
      named.push(list[i]);
    }
  }
  if (named.length === 1) {
    return { how: "name", member: named[0] };
  }
  return { how: named.length > 1 ? "ambiguous" : "", member: null };
}

function paymentTotals(rows, members) {
  var totals = {};
  (rows || []).forEach(function (row) {
    var match = paymentMatch(row, members);
    if (!match.member || !match.member.uid) {
      return;
    }
    var cents = paymentCents(row.total);
    if (cents === null) {
      return;
    }
    var uid = match.member.uid;
    totals[uid] = (totals[uid] || 0) + cents;
  });
  return totals;
}

function paymentMemberWrites(rows, members) {
  var totals = paymentTotals(rows, members);
  var writes = [];
  (members || []).forEach(function (member) {
    if (!member.uid) {
      return;
    }
    var cents = totals[member.uid] || 0;
    var current = paymentCents(member.amount);
    if (current === null) {
      current = 0;
    }
    var fee = paymentFeeCents(member.stay);
    var nextPaid = null;
    if (fee !== null) {
      nextPaid = cents >= fee ? "yes" : "";
    }
    var sameAmount = current === cents;
    var samePaid =
      nextPaid === null || (member.camp_fee_paid || "") === nextPaid;
    if (sameAmount && samePaid) {
      return;
    }
    var write = {
      uid: member.uid,
      amount: cents ? paymentAmountText(cents) : "",
    };
    if (nextPaid !== null) {
      write.camp_fee_paid = nextPaid;
    }
    writes.push(write);
  });
  return writes;
}

function paymentSummary(rows, members) {
  var unassigned = [];
  var byName = [];
  (rows || []).forEach(function (row) {
    var match = paymentMatch(row, members);
    var label = row.contributor || row.sheet_kode || "A payment";
    if (!match.member) {
      unassigned.push(label);
    } else if (match.how === "name") {
      byName.push(label);
    }
  });
  var text = "Saved " + (rows || []).length + " payments.";
  if (unassigned.length) {
    text += " Unassigned: " + unassigned.join(", ") + ".";
  }
  if (byName.length) {
    text += " Matched by name: " + byName.join(", ") + ".";
  }
  return text;
}
