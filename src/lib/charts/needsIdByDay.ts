import { groupBy, orderBy, sortBy, uniqBy } from "lodash-es";
import { iconicTaxonEmoji } from "./taxonLabels";
import {
  taxonObservationsUrl,
  taxonPageUrl,
  type ChartTaxon,
} from "./taxonLinks";
import type { ObservationSummary } from "@/lib/inat/observations";
import { speciesName } from "@/lib/inat/observations";
import { formatDate } from "@/lib/days";

export interface NeedsIdDaySpecies {
  taxon: ChartTaxon;
  label: string;
  url: string;
  starred: boolean;
}

export interface NeedsIdDay {
  day: string;
  label: string;
  species: NeedsIdDaySpecies[];
}

export function needsIdByDayRows(summary: ObservationSummary): NeedsIdDay[] {
  const minDate = new Date();
  minDate.setDate(minDate.getDate() - 30);
  const minDateStr = minDate.toISOString().slice(0, 10);

  const rgNames = new Set(
    summary.researchGradeTaxons.map((t) => speciesName(t.name)),
  );

  const researchGradeSpeciesByDay = new Map<string, Set<string>>();
  for (const obs of summary.researchGradeObservations) {
    const set = researchGradeSpeciesByDay.get(obs.observed_on) ?? new Set();
    set.add(speciesName(obs.taxon.name));
    researchGradeSpeciesByDay.set(obs.observed_on, set);
  }

  const eligible = summary.needsIdObservations.filter(
    (obs) =>
      obs.observed_on >= minDateStr &&
      !researchGradeSpeciesByDay
        .get(obs.observed_on)
        ?.has(speciesName(obs.taxon.name)),
  );

  const byDay = groupBy(eligible, (obs) => obs.observed_on);

  const days: NeedsIdDay[] = Object.entries(byDay).map(([day, obsList]) => {
    const species = uniqBy(obsList, (obs) => speciesName(obs.taxon.name)).map(
      (obs) => {
        const name = speciesName(obs.taxon.name);
        const taxon = obs.taxon;
        const commonName = taxon.preferred_common_name;
        const emoji = iconicTaxonEmoji(taxon.iconic_taxon_name);
        const chartTaxon: ChartTaxon = { id: taxon.id, name };
        return {
          taxon: chartTaxon,
          label: commonName
            ? `${emoji} ${commonName} (${name})`
            : `${emoji} ${name}`,
          url:
            taxonObservationsUrl(taxon.id, "needs_id", { on: day }) ??
            taxonPageUrl(chartTaxon),
          starred: !rgNames.has(name),
        };
      },
    );
    return {
      day,
      label: `${formatDate(day)} — ${species.length} species`,
      species: sortBy(species, (s) => s.label),
    };
  });

  return orderBy(days, (d) => d.day, "desc");
}
