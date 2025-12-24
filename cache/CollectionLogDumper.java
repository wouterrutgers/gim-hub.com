package net.runelite.cache;

import com.google.common.collect.ImmutableList;
import com.google.common.io.Files;
import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import lombok.Data;
import net.runelite.cache.definitions.EnumDefinition;
import net.runelite.cache.definitions.ItemDefinition;
import net.runelite.cache.definitions.StructDefinition;
import net.runelite.cache.definitions.loaders.EnumLoader;
import net.runelite.cache.fs.Archive;
import net.runelite.cache.fs.ArchiveFiles;
import net.runelite.cache.fs.FSFile;
import net.runelite.cache.fs.Index;
import net.runelite.cache.fs.Storage;
import net.runelite.cache.fs.Store;
import org.apache.commons.cli.CommandLine;
import org.apache.commons.cli.CommandLineParser;
import org.apache.commons.cli.DefaultParser;
import org.apache.commons.cli.Option;
import org.apache.commons.cli.Options;
import org.apache.commons.cli.ParseException;

import java.io.File;
import java.io.IOException;
import java.nio.charset.Charset;
import java.util.ArrayList;
import java.util.List;

public class CollectionLogDumper
{
	private static String outputDirectory;
	private static final List<Integer> COLLECTION_LOG_TAB_STRUCT_IDS = ImmutableList.of(
			471, // Bosses
			472, // Raids
			473, // Clues
			474, // Minigames
			475  // Other
	);
	private static final int COLLECTION_LOG_TAB_ENUM_PARAM_ID = 683;
	private static final int COLLECTION_LOG_PAGE_NAME_PARAM_ID = 689;
	private static final int COLLECTION_LOG_PAGE_ITEMS_ENUM_PARAM_ID = 690;
	private static final Gson gson = new GsonBuilder().setPrettyPrinting().create();

	@Data
	static class CollectionLogItem
	{
		public Integer id;
		public String name;
	}

	@Data
	static class CollectionLogPage
	{
		public String name;
		public List<CollectionLogItem> items = new ArrayList<>();
	}

	@Data
	static class CollectionLogTab
	{
		public Integer tabId;
		public List<CollectionLogPage> pages = new ArrayList<>();
	}

	public static void main(String[] args) throws IOException
	{
		Options options = new Options();
		options.addOption(Option.builder().longOpt("cachedir").hasArg().required().build());
		options.addOption(Option.builder().longOpt("outputdir").hasArg().required().build());

		CommandLineParser parser = new DefaultParser();
		CommandLine cmd;
		try
		{
			cmd = parser.parse(options, args);
		}
		catch (ParseException ex)
		{
			System.err.println("Error parsing command line options: " + ex.getMessage());
			System.exit(-1);
			return;
		}

		final String cacheDirectory = cmd.getOptionValue("cachedir");
		outputDirectory = cmd.getOptionValue("outputdir");

		File base = new File(cacheDirectory);
		File outDir = new File(outputDirectory);
		outDir.mkdirs();

		try (Store store = new Store(base))
		{
			store.load();

			Storage storage = store.getStorage();
			Index index = store.getIndex(IndexType.CONFIGS);
			Archive archive = index.getArchive(ConfigType.ENUM.getId());

			byte[] archiveData = storage.loadArchive(archive);
			ArchiveFiles files = archive.getFiles(archiveData);

			EnumLoader enumLoader = new EnumLoader();
			StructManager structManager = new StructManager(store);
			structManager.load();

			ItemManager itemManager = new ItemManager(store);
			itemManager.load();

			List<CollectionLogTab> collectionLog = new ArrayList<>();

			int tabIdx = 0;
			for (Integer collectionLogTabStructId : COLLECTION_LOG_TAB_STRUCT_IDS)
			{
				StructDefinition tabStruct = structManager.getStruct(collectionLogTabStructId);
				Integer tabEnumId = (Integer) tabStruct.getParams().get(COLLECTION_LOG_TAB_ENUM_PARAM_ID);
				EnumDefinition tabEnum = getEnumDefinition(enumLoader, files, tabEnumId);

				CollectionLogTab collectionLogTab = new CollectionLogTab();
				collectionLogTab.tabId = tabIdx++;
				collectionLog.add(collectionLogTab);

				for (Integer pageStructId : tabEnum.getIntVals())
				{
					StructDefinition pageStruct = structManager.getStruct(pageStructId);
					String pageName = (String) pageStruct.getParams().get(COLLECTION_LOG_PAGE_NAME_PARAM_ID);
					Integer pageItemsEnumId = (Integer) pageStruct.getParams().get(COLLECTION_LOG_PAGE_ITEMS_ENUM_PARAM_ID);
					EnumDefinition pageItemsEnum = getEnumDefinition(enumLoader, files, pageItemsEnumId);

					CollectionLogPage collectionLogPage = new CollectionLogPage();
					collectionLogPage.name = pageName;
					collectionLogTab.pages.add(collectionLogPage);

					for (Integer pageItemId : pageItemsEnum.getIntVals())
					{
						CollectionLogItem collectionLogItem = new CollectionLogItem();
						ItemDefinition item = itemManager.getItem(pageItemId);
						collectionLogItem.id = item.getId();
						collectionLogItem.name = item.getName();
						collectionLogPage.items.add(collectionLogItem);
					}
				}
			}

			Files.asCharSink(new File(outputDirectory, "collection_log_info.json"), Charset.defaultCharset()).write(gson.toJson(collectionLog));
		}
	}

	private static EnumDefinition getEnumDefinition(EnumLoader enumLoader, ArchiveFiles files, Integer enumId) throws IOException
	{
		FSFile enumFile = null;
		for (FSFile file : files.getFiles())
		{
			if (file.getFileId() == enumId)
			{
				enumFile = file;
				break;
			}
		}

		if (enumFile == null)
		{
			throw new IOException("Unable to find enum with id " + enumId);
		}

		byte[] b = enumFile.getContents();
		EnumDefinition enumDefinition = enumLoader.load(enumFile.getFileId(), b);

		if (enumDefinition == null)
		{
			throw new IOException("Unable to load enum definition for enum id " + enumId);
		}

		return enumDefinition;
	}
}
