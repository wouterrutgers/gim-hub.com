import bossIcons from "../assets/data/boss_icons.json";

function normalizeBossName(name) {
  return name.toLowerCase().replace(/^the /, "").replaceAll(":", "");
}

const iconsByName = Object.entries(bossIcons)
  .map(function normalizeIconName([name, icon]) {
    return [normalizeBossName(name), icon];
  })
  .sort(function longestNameFirst([left], [right]) {
    return right.length - left.length;
  });

export function getBossIcon(name) {
  const normalizedName = normalizeBossName(name);

  return iconsByName.find(function matchesBoss([name]) {
    return normalizedName === name || normalizedName.startsWith(`${name} `);
  })?.[1];
}
