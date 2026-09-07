function buildMapLabels(mapLabels) {
  const labels = {};
  const labelNames = {};

  for (const [index, [worldX, worldY, plane, name]] of mapLabels.entries()) {
    const x = worldX + 128;
    const y = worldY + 1;
    const regionX = Math.floor(x / 64);
    const regionY = Math.floor(y / 64);

    labels[regionX] ??= {};
    labels[regionX][regionY] ??= {};
    labels[regionX][regionY][plane] ??= [];
    labels[regionX][regionY][plane].push(x, y, index);
    labelNames[index] = name.replaceAll("<br>", " ").replace(/\s+/g, " ").trim();
  }

  return { labels, labelNames };
}

module.exports = { buildMapLabels };
