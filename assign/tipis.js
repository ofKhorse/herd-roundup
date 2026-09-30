function assignTipis(people, sizes) {
  var eligible = people.filter(function (person) {
    return person.stay !== "van";
  });
  var byCode = indexByCode(eligible);
  var weights = pairWeights(eligible);
  var grouped = mustLinkBlocks(eligible, sizes);
  var remaining = grouped.blocks;
  var tipis = [];
  sizes
    .slice()
    .sort(function (a, b) {
      return b - a;
    })
    .forEach(function (size, index) {
      var chosen = fillSlot(remaining, size, weights, byCode);
      chosen.forEach(function (block) {
        remaining.splice(remaining.indexOf(block), 1);
      });
      tipis.push({
        id: "T" + pad(index + 1),
        size: size,
        blocks: chosen,
      });
    });
  improve(tipis, weights, byCode);
  return {
    tipis: tipis.map(function (tipi) {
      return {
        id: tipi.id,
        size: tipi.size,
        members: flatten(tipi.blocks),
      };
    }),
    unassigned: flatten(remaining),
    conflicts: grouped.conflicts,
  };
}

function indexByCode(people) {
  var byCode = {};
  people.forEach(function (person) {
    byCode[person.member_code] = person;
  });
  return byCode;
}

function pairWeights(people) {
  var weights = {};
  for (var i = 0; i < people.length; i++) {
    for (var j = i + 1; j < people.length; j++) {
      var left = people[i];
      var right = people[j];
      var weight =
        rankPoints(left.share_with, right.member_code) +
        rankPoints(right.share_with, left.member_code);
      if (weight > 0) {
        weights[key(left.member_code, right.member_code)] = weight;
      }
    }
  }
  return weights;
}

function rankPoints(list, code) {
  var index = (list || []).indexOf(code);
  if (index === -1) {
    return 0;
  }
  return 1 / (index + 1);
}

function key(a, b) {
  return a < b ? a + "\0" + b : b + "\0" + a;
}

function weightBetween(weights, a, b) {
  return weights[key(a, b)] || 0;
}

function mustLinkBlocks(people, sizes) {
  var maxSize = sizes.reduce(function (max, size) {
    return Math.max(max, size);
  }, 0);
  var parent = {};
  people.forEach(function (person) {
    parent[person.member_code] = person.member_code;
  });
  function find(code) {
    while (parent[code] !== code) {
      parent[code] = parent[parent[code]];
      code = parent[code];
    }
    return code;
  }
  for (var i = 0; i < people.length; i++) {
    for (var j = i + 1; j < people.length; j++) {
      var left = people[i];
      var right = people[j];
      if (
        listedInTopTwo(left, right.member_code) &&
        listedInTopTwo(right, left.member_code)
      ) {
        parent[find(left.member_code)] = find(right.member_code);
      }
    }
  }
  var groups = {};
  people.forEach(function (person) {
    var root = find(person.member_code);
    groups[root] = groups[root] || [];
    groups[root].push(person.member_code);
  });
  var blocks = [];
  var conflicts = [];
  Object.keys(groups).forEach(function (root) {
    var codes = groups[root];
    if (codes.length > 1 && codes.length > maxSize) {
      conflicts.push(codes.slice());
      codes.forEach(function (code) {
        blocks.push([code]);
      });
      return;
    }
    blocks.push(codes);
  });
  return { blocks: blocks, conflicts: conflicts };
}

function listedInTopTwo(person, code) {
  var index = (person.share_with || []).indexOf(code);
  return index === 0 || index === 1;
}

function fillSlot(remaining, size, weights, byCode) {
  var chosen = [];
  var used = 0;
  var pool = remaining.slice();
  while (used < size && pool.length) {
    var best = null;
    var bestDelta = -1;
    for (var i = 0; i < pool.length; i++) {
      var block = pool[i];
      if (used + block.length > size) {
        continue;
      }
      var delta =
        chosen.length === 0
          ? seedScore(block, pool, size, weights, byCode)
          : scoreDelta(chosen, block, size, weights, byCode);
      if (delta > bestDelta) {
        bestDelta = delta;
        best = block;
      }
    }
    if (!best) {
      break;
    }
    chosen.push(best);
    used += best.length;
    pool.splice(pool.indexOf(best), 1);
  }
  return chosen;
}

function seedScore(block, pool, size, weights, byCode) {
  var external = 0;
  pool.forEach(function (other) {
    if (other === block) {
      return;
    }
    block.forEach(function (code) {
      other.forEach(function (otherCode) {
        external += weightBetween(weights, code, otherCode);
      });
    });
  });
  return scoreCodes(block, size, weights, byCode) * 1000 + external;
}

function scoreDelta(chosen, block, size, weights, byCode) {
  var before = scoreCodes(flatten(chosen), size, weights, byCode);
  var after = scoreCodes(
    flatten(chosen.concat([block])),
    size,
    weights,
    byCode,
  );
  return after - before;
}

function scoreCodes(codes, size, weights, byCode) {
  var score = 0;
  for (var i = 0; i < codes.length; i++) {
    for (var j = i + 1; j < codes.length; j++) {
      score += weightBetween(weights, codes[i], codes[j]);
    }
    var stay = byCode[codes[i]].stay;
    if ((stay === "tipi4" && size === 4) || (stay === "tipi5" && size === 5)) {
      score += 0.05;
    }
  }
  return score;
}

function improve(tipis, weights, byCode) {
  for (var guard = 0; guard < 100; guard++) {
    var move = bestMove(tipis, weights, byCode);
    if (!move) {
      return;
    }
    applyMove(tipis, move);
  }
}

function bestMove(tipis, weights, byCode) {
  var base = totalScore(tipis, weights, byCode);
  var best = null;
  var bestScore = base;
  for (var a = 0; a < tipis.length; a++) {
    for (var i = 0; i < tipis[a].blocks.length; i++) {
      for (var b = 0; b < tipis.length; b++) {
        if (a === b) {
          continue;
        }
        var block = tipis[a].blocks[i];
        if (count(tipis[b]) + block.length > tipis[b].size) {
          continue;
        }
        var score = scoreAfterMove(tipis, a, i, b, weights, byCode);
        if (score > bestScore + 1e-9) {
          bestScore = score;
          best = { kind: "move", a: a, i: i, b: b };
        }
      }
    }
  }
  for (var left = 0; left < tipis.length; left++) {
    for (var right = left + 1; right < tipis.length; right++) {
      for (var li = 0; li < tipis[left].blocks.length; li++) {
        for (var ri = 0; ri < tipis[right].blocks.length; ri++) {
          var leftBlock = tipis[left].blocks[li];
          var rightBlock = tipis[right].blocks[ri];
          if (
            count(tipis[left]) - leftBlock.length + rightBlock.length >
              tipis[left].size ||
            count(tipis[right]) - rightBlock.length + leftBlock.length >
              tipis[right].size
          ) {
            continue;
          }
          var swapped = scoreAfterSwap(
            tipis,
            left,
            li,
            right,
            ri,
            weights,
            byCode,
          );
          if (swapped > bestScore + 1e-9) {
            bestScore = swapped;
            best = { kind: "swap", left: left, li: li, right: right, ri: ri };
          }
        }
      }
    }
  }
  return best;
}

function scoreAfterMove(tipis, from, index, to, weights, byCode) {
  var block = tipis[from].blocks[index];
  var fromCodes = flatten(tipis[from].blocks).filter(function (code) {
    return block.indexOf(code) === -1;
  });
  var toCodes = flatten(tipis[to].blocks).concat(block);
  return (
    totalScore(tipis, weights, byCode) -
    scoreCodes(flatten(tipis[from].blocks), tipis[from].size, weights, byCode) -
    scoreCodes(flatten(tipis[to].blocks), tipis[to].size, weights, byCode) +
    scoreCodes(fromCodes, tipis[from].size, weights, byCode) +
    scoreCodes(toCodes, tipis[to].size, weights, byCode)
  );
}

function scoreAfterSwap(tipis, left, li, right, ri, weights, byCode) {
  var leftBlock = tipis[left].blocks[li];
  var rightBlock = tipis[right].blocks[ri];
  var leftCodes = flatten(tipis[left].blocks)
    .filter(function (code) {
      return leftBlock.indexOf(code) === -1;
    })
    .concat(rightBlock);
  var rightCodes = flatten(tipis[right].blocks)
    .filter(function (code) {
      return rightBlock.indexOf(code) === -1;
    })
    .concat(leftBlock);
  return (
    totalScore(tipis, weights, byCode) -
    scoreCodes(flatten(tipis[left].blocks), tipis[left].size, weights, byCode) -
    scoreCodes(
      flatten(tipis[right].blocks),
      tipis[right].size,
      weights,
      byCode,
    ) +
    scoreCodes(leftCodes, tipis[left].size, weights, byCode) +
    scoreCodes(rightCodes, tipis[right].size, weights, byCode)
  );
}

function applyMove(tipis, move) {
  if (move.kind === "move") {
    var block = tipis[move.a].blocks.splice(move.i, 1)[0];
    tipis[move.b].blocks.push(block);
    return;
  }
  var leftBlock = tipis[move.left].blocks[move.li];
  tipis[move.left].blocks[move.li] = tipis[move.right].blocks[move.ri];
  tipis[move.right].blocks[move.ri] = leftBlock;
}

function totalScore(tipis, weights, byCode) {
  return tipis.reduce(function (sum, tipi) {
    return sum + scoreCodes(flatten(tipi.blocks), tipi.size, weights, byCode);
  }, 0);
}

function count(tipi) {
  return flatten(tipi.blocks).length;
}

function flatten(blocks) {
  var codes = [];
  blocks.forEach(function (block) {
    block.forEach(function (code) {
      codes.push(code);
    });
  });
  return codes;
}

function pad(number) {
  return number < 10 ? "0" + number : String(number);
}

if (typeof module !== "undefined") {
  module.exports = { assignTipis };
}
