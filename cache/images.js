const fs = require("node:fs");
const path = require("node:path");
const async = require("async");
const sharp = require("sharp");

sharp.cache(false);

const concurrency = 8;
const tileSize = 256;

async function convertPngImages(directory) {
  const images = fs.readdirSync(directory).filter(function isPng(file) {
    return file.endsWith(".png");
  });
  console.info(`Converting ${images.length} PNG images in ${directory} to WebP.`);

  await async.eachLimit(images, concurrency, async function convertImage(file) {
    const source = path.join(directory, file);
    await sharp(source)
      .webp({ lossless: true, effort: 6 })
      .toFile(source.replace(/\.png$/, ".webp"));
    fs.unlinkSync(source);
  });
}

async function generateMapTiles(directory) {
  const tilesDirectory = path.join(directory, "tiles");
  const rawDirectory = path.join(directory, "raw-tiles");
  const tiles = [];
  fs.rmSync(tilesDirectory, { recursive: true, force: true });
  fs.mkdirSync(tilesDirectory);

  for (let plane = 0; plane < 4; plane++) {
    const planeDirectory = path.join(rawDirectory, String(plane));

    for (const file of fs.readdirSync(planeDirectory)) {
      const [x, y] = path.basename(file, ".rgb").split("_").map(Number);
      tiles.push({
        source: path.join(planeDirectory, file),
        name: `${plane}_${x + 4608 / tileSize}_${y + 4864 / tileSize}`,
      });
    }
  }

  console.info(`Encoding ${tiles.length} map tiles.`);
  await async.eachLimit(tiles, concurrency, async function encodeTile({ source, name }) {
    await sharp(await fs.promises.readFile(source), { raw: { width: tileSize, height: tileSize, channels: 3 } })
      .webp({ lossless: true, effort: 6 })
      .toFile(path.join(tilesDirectory, `${name}.webp`));
  });
  await fs.promises.rm(rawDirectory, { recursive: true });
}

module.exports = { convertPngImages, generateMapTiles };
