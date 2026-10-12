import { EventEmitter } from "node:events";
import { readFile } from "node:fs/promises";
import path from "node:path";
import superjson from "superjson";
import Config from "@/lib/config";
import { taxonPageUrl } from "@/lib/charts/taxonLinks";
import { inatClient } from "@/lib/inat/client";
import type { components } from "@/lib/inat/schema";
import { readBestOfSnapshot, writeJson } from "@/lib/snapshot";

const CURRENT_TAXON_PATH = path.join(
  Config.cacheDir,
  "labradorite-current.json",
);

export interface CurrentTaxon {
  taxon: string | null;
  updatedAt: string | null;
}

interface LabradoriteState {
  current: CurrentTaxon | null;
  emitter: EventEmitter;
}

// Route handlers and pages can be bundled as separate module instances, so
// the shared state hangs off globalThis.
const globalState = globalThis as typeof globalThis & {
  labradorite?: LabradoriteState;
};
const state = (globalState.labradorite ??= {
  current: null,
  emitter: new EventEmitter().setMaxListeners(0),
});

export async function getCurrentTaxon(): Promise<CurrentTaxon> {
  if (!state.current) {
    try {
      state.current = superjson.parse<CurrentTaxon>(
        await readFile(CURRENT_TAXON_PATH, "utf-8"),
      );
    } catch {
      state.current = { taxon: null, updatedAt: null };
    }
  }
  return state.current;
}

export async function setCurrentTaxon(taxon: string): Promise<void> {
  state.current = { taxon, updatedAt: new Date().toISOString() };
  state.emitter.emit("change", state.current);
  await writeJson(CURRENT_TAXON_PATH, state.current);
}

export function subscribe(
  listener: (current: CurrentTaxon) => void,
): () => void {
  state.emitter.on("change", listener);
  return () => state.emitter.off("change", listener);
}

type ShowTaxon = components["schemas"]["ShowTaxon"] & {
  wikipedia_summary?: string | null;
  wikipedia_url?: string | null;
  ancestors?: components["schemas"]["CoreTaxon"][];
  conservation_status?: {
    status?: string;
    status_name?: string;
    iucn?: number;
    authority?: string;
    place?: { display_name?: string } | null;
  } | null;
};

export interface TaxonAncestor {
  id: number;
  name: string;
  commonName?: string;
  rank?: string;
}

export interface TaxonDetails {
  id: number;
  name: string;
  preferredCommonName?: string;
  rank?: string;
  photo?: { url: string; attribution?: string };
  wikipediaSummary?: string;
  wikipediaUrl?: string;
  ancestors: TaxonAncestor[];
  conservationStatus?: { name: string; authority?: string; place?: string };
  inatUrl: string;
}

const LIFE_TAXON_ID = 48460;

const detailsCache = new Map<string, Promise<TaxonDetails>>();

async function resolveTaxonId(name: string): Promise<number | undefined> {
  const snapshotId = (await readBestOfSnapshot())?.taxonIdByName[name];
  if (snapshotId) return snapshotId;

  const { data, error } = await inatClient.GET("/taxa", {
    params: { query: { q: name, is_active: true } },
  });
  if (error) throw new Error(`Failed to search taxa for ${name}`);
  return data.results.find(
    (taxon) => taxon.name?.toLowerCase() === name.toLowerCase(),
  )?.id;
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .trim();
}

async function fetchTaxonDetails(name: string): Promise<TaxonDetails> {
  const id = await resolveTaxonId(name);
  if (!id) throw new Error(`No iNaturalist taxon named ${name}`);

  const { data, error } = await inatClient.GET("/taxa/{id}", {
    params: { path: { id: [id] } },
  });
  if (error) throw new Error(`Failed to fetch taxon ${id}`);
  const taxon = data.results[0] as ShowTaxon | undefined;
  if (!taxon?.id || !taxon.name) throw new Error(`Missing taxon ${id}`);

  const photo = taxon.default_photo;
  const photoUrl = photo?.medium_url ?? photo?.url;
  const status = taxon.conservation_status;
  const statusName = status?.status_name ?? status?.status;

  return {
    id: taxon.id,
    name: taxon.name,
    preferredCommonName: taxon.preferred_common_name,
    rank: taxon.rank,
    photo: photoUrl
      ? {
          // medium_url is small; iNat serves larger sizes at the same path.
          url: photoUrl.replace("/medium.", "/large."),
          attribution: photo?.attribution,
        }
      : undefined,
    wikipediaSummary: taxon.wikipedia_summary
      ? stripHtml(taxon.wikipedia_summary)
      : undefined,
    wikipediaUrl: taxon.wikipedia_url ?? undefined,
    ancestors: (taxon.ancestors ?? [])
      .filter((a) => a.id && a.name && a.id !== LIFE_TAXON_ID)
      .map((a) => ({
        id: a.id!,
        name: a.name!,
        commonName: a.preferred_common_name,
        rank: a.rank,
      })),
    conservationStatus: statusName
      ? {
          name: statusName,
          authority: status?.authority,
          place: status?.place?.display_name,
        }
      : undefined,
    inatUrl: taxonPageUrl({ id: taxon.id, name: taxon.name }),
  };
}

export function getTaxonDetails(name: string): Promise<TaxonDetails> {
  let details = detailsCache.get(name);
  if (!details) {
    details = fetchTaxonDetails(name);
    detailsCache.set(name, details);
    // Don't cache failures; let the next request retry.
    details.catch(() => detailsCache.delete(name));
  }
  return details;
}
