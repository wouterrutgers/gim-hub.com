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

async function writeTile(image, directory, name) {
  await image
    .flatten({ background: "#000" })
    .webp({ lossless: true, effort: 6 })
    .toFile(path.join(directory, `${name}.webp`));
}

async function generateMapTiles(directory) {
  const tilesDirectory = path.join(directory, "tiles");
  const output = path.join(directory, "output.dz");
  const intermediateDirectory = path.join(directory, "output_files");
  const previousTiles = new Set();
  fs.rmSync(tilesDirectory, { recursive: true, force: true });
  fs.mkdirSync(tilesDirectory);

  try {
    for (let plane = 0; plane < 4; plane++) {
      console.info(`Tiling map plane ${plane + 1}/4`);
      fs.rmSync(intermediateDirectory, { recursive: true, force: true });
      fs.mkdirSync(path.join(intermediateDirectory, "0"), { recursive: true });
      await sharp(path.join(directory, `img-${plane}.png`), { limitInputPixels: false })
        .flip()
        .png({ compressionLevel: 0 })
        .tile({ size: tileSize, depth: "one", background: { r: 0, g: 0, b: 0, alpha: 0 }, skipBlanks: 0 })
        .toFile(output);

      const planeDirectory = path.join(intermediateDirectory, "0");
      await async.eachLimit(fs.readdirSync(planeDirectory), concurrency, async function processTile(file) {
        const [x, y] = path.basename(file, ".png").split("_").map(Number);
        const finalX = x + 4608 / tileSize;
        const finalY = y + 4864 / tileSize;
        const name = `${plane}_${finalX}_${finalY}`;
        let image = sharp(path.join(planeDirectory, file)).flip();
        const backgroundName = `${plane - 1}_${finalX}_${finalY}`;

        if (previousTiles.has(backgroundName)) {
          const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
          const background = await sharp(path.join(tilesDirectory, `${backgroundName}.webp`))
            .linear(0.5)
            .raw()
            .toBuffer({ resolveWithObject: true });
          image = sharp(background.data, {
            raw: { width: background.info.width, height: background.info.height, channels: background.info.channels },
          }).composite([{ input: data, raw: { width: info.width, height: info.height, channels: info.channels } }]);
        }

        await writeTile(image, tilesDirectory, name);
        previousTiles.add(name);
      });

      const belowTiles = [...previousTiles].filter(function isBelow(name) {
        return name.startsWith(`${plane - 1}_`);
      });
      await async.eachLimit(belowTiles, concurrency, async function fillTile(belowTile) {
        const [, x, y] = belowTile.split("_");
        const name = `${plane}_${x}_${y}`;

        if (previousTiles.has(name)) {
          return;
        }

        await writeTile(sharp(path.join(tilesDirectory, `${belowTile}.webp`)).linear(0.5), tilesDirectory, name);
        previousTiles.add(name);
      });
    }
  } finally {
    fs.rmSync(intermediateDirectory, { recursive: true, force: true });
    fs.rmSync(path.join(directory, "output.dzi"), { force: true });
  }
}

module.exports = { convertPngImages, generateMapTiles };
