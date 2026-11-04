package net.runelite.cache;

import java.awt.Point;
import java.awt.image.BufferedImage;
import java.awt.image.DataBuffer;
import java.awt.image.DirectColorModel;
import java.awt.image.Raster;
import java.awt.image.WritableRaster;
import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

public class MapTiles extends DataBuffer {
    protected static final int TILE_SIZE = 256;
    protected final int width;
    protected final int height;
    protected final int columns;
    protected final Map<Integer, int[]> tiles = new ConcurrentHashMap<>();

    public MapTiles(int width, int height) {
        super(TYPE_INT, width * height);
        this.width = width;
        this.height = height;
        this.columns = width / TILE_SIZE;
    }

    public BufferedImage createImage(boolean transparency) {
        DirectColorModel colors = new DirectColorModel(transparency ? 32 : 24,
            0x00FF0000, 0x0000FF00, 0x000000FF, transparency ? 0xFF000000 : 0);
        WritableRaster raster = Raster.createPackedRaster(this, width, height, width, colors.getMasks(), new Point());
        return new BufferedImage(colors, raster, false, null);
    }

    protected int tileIndex(int index) {
        return index / width / TILE_SIZE * columns + index % width / TILE_SIZE;
    }

    protected int tileOffset(int index) {
        return index / width % TILE_SIZE * TILE_SIZE + index % TILE_SIZE;
    }

    @Override
    public int getElem(int bank, int index) {
        int[] pixels = tiles.get(tileIndex(index));
        return pixels == null ? 0 : pixels[tileOffset(index)];
    }

    @Override
    public void setElem(int bank, int index, int value) {
        tiles.computeIfAbsent(tileIndex(index), ignored -> new int[TILE_SIZE * TILE_SIZE])[tileOffset(index)] = value;
    }

    public void blend(MapTiles previous) {
        for (Map.Entry<Integer, int[]> entry : previous.tiles.entrySet()) {
            int[] pixels = tiles.computeIfAbsent(entry.getKey(), ignored -> new int[TILE_SIZE * TILE_SIZE]);
            int[] background = entry.getValue();
            for (int index = 0; index < pixels.length; index++) {
                if (pixels[index] == 0) {
                    pixels[index] = 0xFF000000 | ((background[index] & 0x00FEFEFE) >>> 1);
                }
            }
        }
    }

    public void writeRgbTiles(File directory) throws IOException {
        Files.createDirectories(directory.toPath());
        for (Map.Entry<Integer, int[]> entry : tiles.entrySet()) {
            int[] pixels = entry.getValue();
            byte[] rgb = new byte[pixels.length * 3];
            for (int index = 0; index < pixels.length; index++) {
                rgb[index * 3] = (byte) (pixels[index] >>> 16);
                rgb[index * 3 + 1] = (byte) (pixels[index] >>> 8);
                rgb[index * 3 + 2] = (byte) pixels[index];
            }
            int x = entry.getKey() % columns;
            int y = height / TILE_SIZE - 1 - entry.getKey() / columns;
            Files.write(new File(directory, x + "_" + y + ".rgb").toPath(), rgb);
        }
    }
}
