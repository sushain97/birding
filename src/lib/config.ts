import envPaths from "env-paths";

const paths = envPaths("inat-graphs", { suffix: "" });

const OWNER_API_KEY_PREFIX = "IMMICH_API_KEY_";

function ownerApiKeys(): Record<string, string> {
  const keys: Record<string, string> = {};
  for (const [name, value] of Object.entries(process.env)) {
    if (!name.startsWith(OWNER_API_KEY_PREFIX) || !value) continue;
    const ownerId = name
      .slice(OWNER_API_KEY_PREFIX.length)
      .toLowerCase()
      .replaceAll("_", "-");
    keys[ownerId] = value;
  }
  return keys;
}

const config = {
  inatUserId: "sushain",
  immichBaseUrl: "https://photos.skc.name",
  immichApiKey: process.env.IMMICH_API_KEY!,
  immichOwnerApiKeys: ownerApiKeys(),
  bestOfBirdingAlbumId: "c172ef8b-6f76-4abe-9ed5-cdd3292cc404",
  cacheDir: paths.cache,
};

export default config;
