package net.runelite.cache;

import com.google.gson.GsonBuilder;
import java.io.File;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import net.runelite.cache.definitions.EnumDefinition;
import net.runelite.cache.definitions.loaders.EnumLoader;
import net.runelite.cache.fs.Archive;
import net.runelite.cache.fs.ArchiveFiles;
import net.runelite.cache.fs.FSFile;
import net.runelite.cache.fs.Store;

public class CombatAchievementDumper {
    private static final int MONSTER_NAMES_ENUM = 3970;
    private static final int FIRST_TIER_ENUM = 3981;
    private static final int TASK_ID = 1306;
    private static final int TASK_NAME = 1308;
    private static final int TASK_DESCRIPTION = 1309;
    private static final int TASK_MONSTER = 1312;

    static class Task {
        int id;
        String name;
        String description;
        int tier;
        String monster;
    }

    public static void main(String[] args) throws IOException {
        try (Store store = new Store(new File(args[0]))) {
            store.load();
            StructManager structs = new StructManager(store);
            structs.load();
            Archive archive = store.getIndex(IndexType.CONFIGS).getArchive(ConfigType.ENUM.getId());
            ArchiveFiles files = archive.getFiles(store.getStorage().loadArchive(archive));
            EnumDefinition monsters = loadEnum(files, MONSTER_NAMES_ENUM);
            Map<Integer, String> monsterNames = new HashMap<>();

            for (int index = 0; index < monsters.getSize(); index++) {
                monsterNames.put(monsters.getKeys()[index], monsters.getStringVals()[index]);
            }

            List<Task> tasks = new ArrayList<>();

            for (int tier = 1; tier <= 6; tier++) {
                for (int structId : loadEnum(files, FIRST_TIER_ENUM + tier - 1).getIntVals()) {
                    Map<Integer, Object> parameters = structs.getStruct(structId).getParams();
                    Task task = new Task();
                    task.id = (Integer) parameters.get(TASK_ID);
                    task.name = cleanText((String) parameters.get(TASK_NAME));
                    task.description = cleanText((String) parameters.get(TASK_DESCRIPTION));
                    task.tier = tier;
                    task.monster = Objects.requireNonNull(monsterNames.get((Integer) parameters.get(TASK_MONSTER)), "Missing monster for task " + task.id + ": " + parameters);
                    tasks.add(task);
                }
            }

            tasks.sort(Comparator.comparingInt(task -> task.id));
            Files.writeString(new File(args[1]).toPath(), new GsonBuilder().setPrettyPrinting().disableHtmlEscaping().create().toJson(tasks) + "\n", StandardCharsets.UTF_8);
        }
    }

    private static String cleanText(String text) {
        return text.replace("<br>", " ").replaceAll("<[^>]+>", "");
    }

    private static EnumDefinition loadEnum(ArchiveFiles files, int id) throws IOException {
        for (FSFile file : files.getFiles()) {
            if (file.getFileId() == id) {
                return new EnumLoader().load(id, file.getContents());
            }
        }

        throw new IOException("Unable to find combat achievement enum " + id);
    }
}
