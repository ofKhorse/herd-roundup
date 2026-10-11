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

function paymentMainMatch_(row, members) {
  var list = members || [];
  var payment = row || {};
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
  return paymentMainMatch_(payment, list);
}

function paymentAllocate(row, members) {
  var payment = row || {};
  var list = members || [];
  var totalCents = paymentCents(payment.total);
  if (totalCents === null) {
    totalCents = 0;
  }
  var mainMatch = paymentMainMatch_(payment, list);
  var mainKode = mainMatch.member
    ? paymentKode(mainMatch.member.member_code)
    : "";
  var rawShares = payment.shares;
  var shareList;
  if (rawShares && rawShares.length > 0) {
    shareList = rawShares;
  } else if (paymentKode(payment.override_kode)) {
    shareList = [{ kode: payment.override_kode, amount: payment.total }];
  } else {
    shareList = [];
  }
  var shareCentsTotal = 0;
  var processedShares = [];
  var seenKodes = {};
  for (var i = 0; i < shareList.length; i++) {
    var s = shareList[i] || {};
    var kode = paymentKode(s.kode);
    if (!kode || seenKodes[kode] || kode === mainKode) {
      continue;
    }
    var cents = paymentCents(s.amount);
    if (cents === null || cents <= 0) {
      continue;
    }
    seenKodes[kode] = true;
    processedShares.push({
      kode: kode,
      cents: cents,
      member: paymentMemberByKode_(list, kode),
    });
    shareCentsTotal += cents;
  }
  var remainder = Math.max(0, totalCents - shareCentsTotal);
  var kept = remainder;
  if (mainMatch.member && remainder > 36500) {
    kept = 36500;
  }
  if (!mainMatch.member) {
    kept = 0;
  }
  return {
    mainMatch: mainMatch,
    shares: processedShares,
    remainder: remainder,
    kept: kept,
    unassigned: remainder - kept,
    hasLeftover: remainder - kept > 0,
  };
}

function paymentTotals(rows, members) {
  var totals = {};
  (rows || []).forEach(function (row) {
    var alloc = paymentAllocate(row, members);
    alloc.shares.forEach(function (share) {
      if (share.member && share.member.uid) {
        totals[share.member.uid] =
          (totals[share.member.uid] || 0) + share.cents;
      }
    });
    if (
      alloc.mainMatch.member &&
      alloc.mainMatch.member.uid &&
      alloc.kept > 0
    ) {
      var uid = alloc.mainMatch.member.uid;
      totals[uid] = (totals[uid] || 0) + alloc.kept;
    }
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
    var alloc = paymentAllocate(row, members);
    var label = row.contributor || row.sheet_kode || "A payment";
    if (alloc.hasLeftover) {
      unassigned.push(label);
    } else if (alloc.mainMatch.how === "name") {
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

function paymentTableStats(rows) {
  var tipi = 36500;
  var total = 0;
  var exact = 0;
  var bundles = 0;
  var bundleTipis = 0;
  var remaining = [];
  (rows || []).forEach(function (row) {
    var cents = paymentCents(row && row.total);
    if (cents === null) {
      return;
    }
    total += cents;
    if (cents === tipi) {
      exact += 1;
      return;
    }
    if (cents > tipi && cents % tipi === 0) {
      bundles += 1;
      bundleTipis += cents / tipi;
      return;
    }
    remaining.push(paymentAmountText(cents));
  });
  return {
    totalCents: total,
    exact: exact,
    bundles: bundles,
    bundleTipis: bundleTipis,
    remaining: remaining,
  };
}
