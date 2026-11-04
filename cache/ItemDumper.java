package net.runelite.api;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.File;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import net.runelite.client.game.ItemMapping;

public class ItemDumper {
    public static void main(String[] args) throws IOException {
        File file = new File(args[0]);
        ObjectMapper objectMapper = new ObjectMapper();
        Map<String, Map<String, Object>> items = objectMapper.readValue(file, new TypeReference<Map<String, Map<String, Object>>>() {});

        for (Map<String, Object> item : items.values()) {
            List<Map<String, Integer>> tradeableItems = fetchTradeableItems((int) item.get("id"));
            if (tradeableItems != null) {
                tradeableItems.sort(Comparator.comparingInt(mapping -> mapping.get("id")));
            }
            item.put("mapping", tradeableItems);
        }
        objectMapper.writeValue(file, items);
    }

    private static List<Map<String, Integer>> fetchTradeableItems(int itemId) {
        Collection<ItemMapping> itemMappings = ItemMapping.map(itemId);

        if (itemMappings == null || itemMappings.isEmpty()) {
            return null;
        }

        List<Map<String, Integer>> tradeableMappings = new ArrayList<>();

        for (ItemMapping mapping : itemMappings) {
            int tradeableItemId = mapping.getTradeableItem();

            if (tradeableItemId == itemId) {
                continue;
            }

            List<Map<String, Integer>> subMappings = fetchTradeableItems(tradeableItemId);
            if (subMappings != null) {
                for (Map<String, Integer> subMapping : subMappings) {
                    tradeableMappings.add(createItemMapping(subMapping.get("id"), (int) (subMapping.get("quantity") * mapping.getQuantity())));
                }
            } else {
                tradeableMappings.add(createItemMapping(tradeableItemId, (int) mapping.getQuantity()));
            }
        }

        return tradeableMappings;
    }

    private static Map<String, Integer> createItemMapping(int itemId, int quantity) {
        Map<String, Integer> itemMapping = new LinkedHashMap<>();
        itemMapping.put("id", itemId);
        itemMapping.put("quantity", quantity);

        return itemMapping;
    }
}
