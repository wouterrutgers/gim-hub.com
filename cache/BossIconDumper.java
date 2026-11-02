package net.runelite.client.plugins.chatcommands;

import com.google.gson.GsonBuilder;
import java.awt.image.BufferedImage;
import java.io.File;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.TreeMap;
import javax.imageio.ImageIO;
import net.runelite.cache.SpriteManager;
import net.runelite.cache.fs.Store;
import net.runelite.client.hiscore.HiscoreSkill;
import net.runelite.client.hiscore.HiscoreSkillType;

public class BossIconDumper {
    @SuppressWarnings("unchecked")
    public static void main(String[] args) throws Exception {
        Method resolveBossName = ChatCommandsPlugin.class.getDeclaredMethod("longBossName", String.class);
        resolveBossName.setAccessible(true);
        Field renameField = ChatCommandsPlugin.class.getDeclaredField("KILLCOUNT_RENAMES");
        renameField.setAccessible(true);
        Map<String, String> renames = (Map<String, String>) renameField.get(null);
        Map<String, String> icons = new TreeMap<>();
        Map<String, BufferedImage> images = new TreeMap<>();

        try (Store store = new Store(new File(args[0]))) {
            store.load();
            SpriteManager sprites = new SpriteManager(store);
            sprites.load();

            for (HiscoreSkill boss : HiscoreSkill.values()) {
                if (boss.getType() != HiscoreSkillType.BOSS) {
                    continue;
                }

                String filename = "boss-" + boss.getName().toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]", "") + ".png";
                images.put(filename, sprites.getSpriteImage(Objects.requireNonNull(sprites.findSprite(boss.getSpriteId(), 0), boss.getName())));
                String imagePath = "/icons/" + filename;
                String resolvedName = (String) resolveBossName.invoke(null, boss.getName());
                icons.put(boss.getName(), imagePath);
                icons.put(resolvedName, imagePath);

                for (Map.Entry<String, String> rename : renames.entrySet()) {
                    if (resolvedName.equalsIgnoreCase((String) resolveBossName.invoke(null, rename.getValue()))) {
                        icons.put(rename.getKey(), imagePath);
                        icons.put(rename.getKey().replaceFirst(" (kill|chest|completion)$", ""), imagePath);
                    }
                }
            }
        }

        File outputDirectory = new File(args[1]);
        Files.createDirectories(outputDirectory.toPath());

        for (Map.Entry<String, BufferedImage> image : images.entrySet()) {
            ImageIO.write(image.getValue(), "png", new File(outputDirectory, image.getKey()));
        }

        Files.writeString(new File(args[2]).toPath(), new GsonBuilder().setPrettyPrinting().disableHtmlEscaping().create().toJson(icons) + "\n", StandardCharsets.UTF_8);
    }
}
