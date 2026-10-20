import { parse } from "csv-parse/sync";
import { speciesName, type ObservationSummary } from "@/lib/inat/observations";

const NAME_OVERRIDES: Record<string, string> = {
  "Larus occidentalis x glaucescens": "Larus glaucescens × occidentalis",
};

export type EbirdComparisonStatus =
  "missing-in-inat" | "needs-id" | "missing-in-ebird";

export interface EbirdComparisonEntry {
  scientificName: string;
  commonName: string;
  status: EbirdComparisonStatus;
  inatTaxonId?: number;
}

function normalizeEbirdName(name: string): string {
  const stripped = name
    .replace(" (Domestic type)", "")
    .replace(" (Feral Pigeon)", "");
  return NAME_OVERRIDES[stripped] ?? stripped;
}

/** Parses an eBird life list CSV export into scientific → common names. */
export function parseEbirdLifeList(csv: string): Map<string, string> {
  const rows = parse<Record<string, string>>(csv, {
    columns: true,
    bom: true,
  });

  const taxons = new Map<string, string>();
  for (const row of rows) {
    const scientificName = row["Scientific Name"];
    if (!scientificName) {
      throw new Error("CSV is missing a 'Scientific Name' column");
    }
    taxons.set(normalizeEbirdName(scientificName), row["Common Name"] ?? "");
  }
  return taxons;
}

export function compareWithInat(
  ebirdTaxons: Map<string, string>,
  summary: ObservationSummary,
): EbirdComparisonEntry[] {
  const inatTaxons = new Map(
    summary.researchGradeTaxons
      .filter((t) => t.iconic_taxon_name === "Aves" && t.name)
      .map((t) => [speciesName(t.name), t] as const),
  );
  const inatNeedsIdTaxons = new Map(
    summary.needsIdTaxons
      .filter((t) => t.name)
      .map((t) => [speciesName(t.name), t] as const),
  );

  const entries: EbirdComparisonEntry[] = [];
  for (const [scientificName, commonName] of ebirdTaxons) {
    if (inatTaxons.has(scientificName)) continue;

    const needsIdTaxon = inatNeedsIdTaxons.get(scientificName);
    entries.push({
      scientificName,
      commonName,
      status:
        needsIdTaxon || scientificName === "Larus livens"
          ? "needs-id"
          : "missing-in-inat",
      inatTaxonId: needsIdTaxon?.id,
    });
  }
  for (const [scientificName, taxon] of inatTaxons) {
    if (ebirdTaxons.has(scientificName)) continue;

    entries.push({
      scientificName,
      commonName: taxon.preferred_common_name ?? "",
      status: "missing-in-ebird",
      inatTaxonId: taxon.id,
    });
  }
  return entries;
}
