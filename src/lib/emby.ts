const EMBY_URL = "http://192.168.5.10:9696";
const EMBY_API_KEY = "d7dd111719ea4d5e9e40710ecada6fa9";

export interface EmbyLibrary {
  Name: string;
  CollectionType: string;
  Locations: string[];
  ItemId: string;
}

export interface EmbyItem {
  Name: string;
  Id: string;
  Type: string;
  ProductionYear?: number;
  ProviderIds?: Record<string, string>;
}

export async function embyFetch(endpoint: string, params: Record<string, string> = {}) {
  const url = new URL(`${EMBY_URL}${endpoint}`);
  url.searchParams.set("api_key", EMBY_API_KEY);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Emby API error: ${res.status} ${res.statusText}`);
  return res.json();
}

export async function testEmbyConnection() {
  try {
    const data = await embyFetch("/System/Info");
    return {
      success: true,
      serverName: data.ServerName,
      version: data.Version,
      os: data.OperatingSystemDisplayName,
    };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

export async function getEmbyLibraries(): Promise<EmbyLibrary[]> {
  const data = await embyFetch("/Library/VirtualFolders");
  return data.map((lib: any) => ({
    Name: lib.Name,
    CollectionType: lib.CollectionType || "unknown",
    Locations: lib.Locations || [],
    ItemId: lib.ItemId || "",
  }));
}

export async function getEmbyCollection(libraryName: string): Promise<EmbyItem[]> {
  const allItems: EmbyItem[] = [];
  let startIndex = 0;
  const limit = 500;
  
  // Determine item type based on library
  const lib = await getEmbyLibraries();
  const libInfo = lib.find(l => l.Name === libraryName);
  let itemType = "Series";
  if (libInfo?.CollectionType === "movies") itemType = "Movie";
  else if (libInfo?.CollectionType === "tvshows") itemType = "Series";
  else if (libInfo?.CollectionType === "music") itemType = "MusicAlbum";
  else if (libInfo?.CollectionType === "musicvideos") itemType = "MusicVideo";

  while (true) {
    const data = await embyFetch("/Items", {
      Recursive: "true",
      IncludeItemTypes: itemType,
      Fields: "ProviderIds",
      StartIndex: startIndex.toString(),
      Limit: limit.toString(),
    });

    if (!data.Items || data.Items.length === 0) break;
    allItems.push(...data.Items);
    if (data.Items.length < limit) break;
    startIndex += limit;
  }

  return allItems;
}

export async function searchEmby(title: string, libraryName?: string): Promise<EmbyItem[]> {
  const params: Record<string, string> = {
    Recursive: "true",
    SearchTerm: title,
    Limit: "5",
  };

  if (libraryName) {
    const libs = await getEmbyLibraries();
    const lib = libs.find(l => l.Name === libraryName);
    if (lib?.CollectionType === "movies") params.IncludeItemTypes = "Movie";
    else if (lib?.CollectionType === "tvshows") params.IncludeItemTypes = "Series";
  }

  const data = await embyFetch("/Items", params);
  return data.Items || [];
}
