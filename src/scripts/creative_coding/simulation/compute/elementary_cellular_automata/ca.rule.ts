export function mirrorrule(rule: number) {
  const ruleset = [];
  let rul = rule;
  for (let j = 0; j < 8; j++) {
    ruleset.push(rul % 2);
    rul = Math.floor(rul / 2);
  }
  ruleset.reverse();
  let mirrrul = 0;
  for (let j = 0; j < 8; j++) {
    mirrrul *= 2;
    const z = "000";
    const compid = parseInt(
      z.concat(j.toString(2)).split("").reverse().slice(0, 3).join(""),
      2,
    );
    mirrrul += ruleset[compid];
  }
  return mirrrul;
}

export function complementrule(rule: number) {
  const ruleset = [];
  let rul = rule;
  for (let j = 0; j < 8; j++) {
    ruleset.push(rul % 2);
    rul = Math.floor(rul / 2);
  }
  ruleset.reverse();
  let comprul = 0;
  for (let j = 0; j < 8; j++) {
    comprul *= 2;
    const z = "000";
    const compid = parseInt(
      z
        .concat(j.toString(2))
        .split("")
        .map(function not(n) {
          if (n == "1") {
            return "0";
          } else {
            return "1";
          }
        })
        .reverse()
        .slice(0, 3)
        .reverse()
        .join(""),
      2,
    );
    comprul += 1 - ruleset[compid];
  }
  return comprul;
}

export function mirrorcomplementrule(rule: number) {
  const ruleset = [];
  let rul = rule;
  for (let j = 0; j < 8; j++) {
    ruleset.push(rul % 2);
    rul = Math.floor(rul / 2);
  }
  ruleset.reverse();
  let comprul = 0;
  for (let j = 0; j < 8; j++) {
    comprul *= 2;
    const z = "000";
    const compid = parseInt(
      z
        .concat(j.toString(2))
        .split("")
        .map(function not(n) {
          if (n == "1") {
            return "0";
          } else {
            return "1";
          }
        })
        .reverse()
        .slice(0, 3)
        .join(""),
      2,
    );
    comprul += 1 - ruleset[compid];
  }
  return comprul;
}

export function outertotalistn(rule: number) {
  const ruleset = [];
  let rul = rule;
  for (let j = 0; j < 6; j++) {
    ruleset.push(rul % 2);
    rul = Math.floor(rul / 2);
  }
  ruleset.reverse();
  let ruls = 0;
  for (let j = 0; j < 8; j++) {
    ruls *= 2;
    const z = "000";
    const neighbors = z.concat(j.toString(2)).split("").reverse().slice(0, 3);
    let id = 0;
    if (neighbors[0] === "1") {
      id += 2;
    }
    if (neighbors[1] === "1") {
      id += 1;
    }
    if (neighbors[2] === "1") {
      id += 2;
    }
    ruls += ruleset[id];
  }
  return ruls;
}
