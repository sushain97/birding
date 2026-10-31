import { Suspense } from "react";
import Markdown from "markdown-to-jsx/react";
import {
  Accordion,
  Anchor,
  AccordionControl,
  AccordionItem,
  AccordionPanel,
  Stack,
  Text,
} from "@mantine/core";
import Config from "@/lib/config";
import { readBestOfSnapshot } from "@/lib/snapshot";
import { buildBestOfRows } from "@/lib/immich/best-of";
import { BestOfTable } from "@/components/best-of/BestOfTable";

// Reads the on-disk snapshot the background scheduler keeps refreshing —
// must never be statically prerendered at build time.
export const dynamic = "force-dynamic";

const WARNING_MARKDOWN_OPTIONS = {
  forceInline: true,
  overrides: { a: { component: Anchor, props: { target: "_blank" } } },
};

export default async function BestOfPage() {
  const bestOf = await readBestOfSnapshot();
  if (!bestOf) {
    return <Text c="dimmed">Loading best-of album…</Text>;
  }

  return (
    <Stack gap="md">
      {bestOf.warnings.length > 0 && (
        <Accordion variant="separated">
          <AccordionItem value="warnings">
            <AccordionControl>
              Warnings ({bestOf.warnings.length})
            </AccordionControl>
            <AccordionPanel>
              <ul>
                {bestOf.warnings.map((w) => (
                  <li key={w}>
                    <Markdown options={WARNING_MARKDOWN_OPTIONS}>{w}</Markdown>
                  </li>
                ))}
              </ul>
            </AccordionPanel>
          </AccordionItem>
        </Accordion>
      )}
      <Suspense>
        <BestOfTable
          rows={buildBestOfRows(bestOf)}
          photos={bestOf.photos}
          immichBaseUrl={Config.immichBaseUrl}
          albumId={Config.bestOfBirdingAlbumId}
        />
      </Suspense>
    </Stack>
  );
}
