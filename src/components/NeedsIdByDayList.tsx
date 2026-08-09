"use client";

import { Accordion, Anchor, Text } from "@mantine/core";
import type { NeedsIdDay } from "@/lib/charts/needsIdByDay";

export function NeedsIdByDayList({ rows }: { rows: NeedsIdDay[] }) {
  if (rows.length === 0) {
    return <Text c="dimmed">No Needs ID species in the last 30 days.</Text>;
  }

  return (
    <Accordion variant="separated">
      {rows.map((row) => (
        <Accordion.Item key={row.day} value={row.day}>
          <Accordion.Control>{row.label}</Accordion.Control>
          <Accordion.Panel>
            <ul style={{ listStyle: "none", paddingLeft: 0 }}>
              {row.species.map((s) => (
                <li key={s.taxon.name}>
                  <Anchor href={s.url} target="_blank" underline="never">
                    {s.label}
                  </Anchor>
                  {s.starred ? " ⭐" : ""}
                </li>
              ))}
            </ul>
          </Accordion.Panel>
        </Accordion.Item>
      ))}
    </Accordion>
  );
}
