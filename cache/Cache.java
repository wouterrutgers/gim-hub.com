package net.runelite.cache;

import com.google.gson.Gson;
import net.runelite.cache.definitions.ItemDefinition;
import net.runelite.cache.definitions.loaders.GameValLoader;
import net.runelite.cache.definitions.loaders.ModelLoader;
import net.runelite.cache.definitions.providers.ModelProvider;
import net.runelite.cache.fs.Archive;
import net.runelite.cache.fs.FSFile;
import net.runelite.cache.fs.Index;
import net.runelite.cache.fs.Store;
import net.runelite.cache.item.ItemSpriteFactory;
import org.apache.commons.cli.*;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.BufferedReader;
import java.io.File;
import java.io.FileReader;
import java.io.IOException;
import java.io.Writer;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

public class Cache {
  private static final int LAST_MAN_STANDING_PARAM = 403;
  private static final int MULTIRUNES_TABLE = 91;

  public static void main(String[] args) throws IOException {
    Options options = new Options();

    options.addOption("c", "cache", true, "cache base");
    options.addOption(null, "items", true, "file to dump item data to");

    options.addOption(null, "ids", true, "csv file with item ids to create images from");
    options.addOption(null, "output", true, "directory to dump item model images to");

    CommandLineParser parser = new DefaultParser();
    CommandLine cmd;
    try {
      cmd = parser.parse(options, args);
    } catch (ParseException ex) {
      System.err.println("Error parsing command line options: " + ex.getMessage());
      System.exit(-1);
      return;
    }

    String cache = cmd.getOptionValue("cache");

    Store store = loadStore(cache);

    if (cmd.hasOption("items")) {
      ItemManager items = new ItemManager(store);
      items.load();
      Map<Integer, String> gameValNames = loadGameValNames(store);
      Map<Integer, List<Integer>> alternativeRunes = loadAlternativeRunes(store);
      Map<Integer, Map<String, Object>> data = new TreeMap<>();
      for (ItemDefinition item : items.getItems()) {
        Map<String, Object> values = new LinkedHashMap<>();
        values.put("id", item.id);
        values.put("name", item.name);
        values.put("cost", item.cost);
        values.put("countCo", item.countCo);
        values.put("countObj", item.countObj);
        if (item.params != null && Integer.valueOf(1).equals(item.params.get(LAST_MAN_STANDING_PARAM))) {
          values.put("lastManStanding", true);
        }
        String gameValName = gameValNames.get(item.id);
        if (gameValName != null) {
          values.put("gameVal", gameValName);
          if (gameValName.endsWith("_legacy")) {
            values.put("legacy", true);
          }
        }
        if (alternativeRunes.containsKey(item.id)) {
          values.put("alternativeRunes", alternativeRunes.get(item.id));
        }
        data.put(item.id, values);
      }
      try (Writer writer = Files.newBufferedWriter(new File(cmd.getOptionValue("items")).toPath(), StandardCharsets.UTF_8)) {
        new Gson().toJson(data, writer);
      }
      return;
    }

    if (cmd.hasOption("output") && cmd.hasOption("ids")) {
      String outputDir = cmd.getOptionValue("output");
      String imageIdsFile = cmd.getOptionValue("ids");

      if (outputDir == null) {
        System.err.println("Item image directory must be specified");
        return;
      }

      if (imageIdsFile == null) {
        System.err.println("Image ID CSV file must be specified");
        return;
      }

      List<Integer> itemIds = new ArrayList<>();
      try (BufferedReader br = new BufferedReader(new FileReader(imageIdsFile))) {
        String line = br.readLine();
        if (line != null) {
          String[] values = line.split(",");
          for (String value : values) {
            Integer itemId = Integer.parseInt(value);
            itemIds.add(itemId);
          }
        }
      }

      System.out.println("Dumping item model images to " + outputDir);
      dumpItemModelImages(store, new File(outputDir), itemIds);
    } else {
      System.err.println("Nothing to do");
    }
  }

  private static Store loadStore(String cache) throws IOException {
    Store store = new Store(new File(cache));
    store.load();
    return store;
  }

  private static Map<Integer, String> loadGameValNames(Store store) throws IOException {
    GameValLoader loader = new GameValLoader();
    Archive archive = store.getIndex(IndexType.GAMEVALS).getArchive(GameValLoader.ITEMS);
    Map<Integer, String> names = new HashMap<>();
    for (FSFile file : archive.getFiles(store.getStorage().loadArchive(archive)).getFiles()) {
      String name = loader.load(GameValLoader.ITEMS, file.getFileId(), file.getContents()).getName();
      names.put(file.getFileId(), name);
    }
    return names;
  }

  private static Map<Integer, List<Integer>> loadAlternativeRunes(Store store) throws IOException {
    DBRowManager rows = new DBRowManager(store);
    rows.load();
    Map<Integer, List<Integer>> alternatives = new HashMap<>();
    for (var row : rows.getRows()) {
      if (row.getTableId() != MULTIRUNES_TABLE) {
        continue;
      }
      Object[][] columns = row.getColumnValues();
      int baseRune = (int) columns[0][0];
      List<Integer> runes = new ArrayList<>();
      // Each tuple holds a combination rune and the other rune it supplies.
      for (int index = 0; index < columns[1].length; index += 2) {
        runes.add((int) columns[1][index]);
      }
      alternatives.put(baseRune, runes);
    }
    return alternatives;
  }

  private static void dumpItemModelImages(Store store, File outputDir, List<Integer> itemIds) throws IOException {
    ItemManager dumper = new ItemManager(store);
    dumper.load();

    ModelProvider modelProvider = modelId -> {
      Index models = store.getIndex(IndexType.MODELS);
      Archive archive = models.getArchive(modelId);

      byte[] data = archive.decompress(store.getStorage().loadArchive(archive));
      return new ModelLoader().load(modelId, data);
    };

    SpriteManager spriteManager = new SpriteManager(store);
    spriteManager.load();

    TextureManager textureManager = new TextureManager(store);
    textureManager.load();

    if (!outputDir.exists()) {
      outputDir.mkdir();
    }

    for (Integer itemId : itemIds) {
      try {
        final int border = 1;
        final int shadowColor = 0x111111;
        final boolean noted = false;
        BufferedImage sprite = ItemSpriteFactory.createSprite(
            dumper,
            modelProvider,
            spriteManager,
            textureManager,
            itemId,
            1,
            border,
            shadowColor,
            noted);

        File out = new File(outputDir, itemId + ".png");
        assert sprite != null;
        ImageIO.write(sprite, "PNG", out);
      } catch (Exception ex) {
        System.err.println("error dumping item " + itemId);
      }
    }
  }
}
