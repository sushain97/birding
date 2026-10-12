"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Affix,
  Box,
  Button,
  Container,
  ThemeIcon,
  Tooltip,
} from "@mantine/core";
import { FastForwardIcon, WifiSlashIcon } from "@phosphor-icons/react";
import type { CurrentTaxon } from "@/lib/labradorite";

// Button height (sm) plus its bottom offset.
const JUMP_BUTTON_SPACE = 36 + 16;

function taxonHref(taxon: string): string {
  return `/labradorite?${new URLSearchParams({ taxon })}`;
}

export function LiveFollower({ displayedTaxon }: { displayedTaxon: string }) {
  const router = useRouter();
  const [liveTaxon, setLiveTaxon] = useState<string | null>(null);
  // Undecided until the first live message arrives.
  const [following, setFollowing] = useState<boolean>();
  const initialTaxon = useRef(displayedTaxon);
  const [disconnected, setDisconnected] = useState(false);

  useEffect(() => {
    const source = new EventSource("/api/labradorite/current");
    source.onopen = () => setDisconnected(false);
    source.onerror = () => setDisconnected(true);
    source.onmessage = (event: MessageEvent<string>) => {
      const current = JSON.parse(event.data) as CurrentTaxon;
      setDisconnected(false);
      setLiveTaxon(current.taxon);
      // Only follow if the page opened on the live taxon (or on none), so a
      // deliberately linked taxon isn't immediately replaced.
      setFollowing(
        (prev) =>
          prev ??
          (!initialTaxon.current ||
            !current.taxon ||
            current.taxon === initialTaxon.current),
      );
    };
    return () => source.close();
  }, []);

  // Back/forward means the viewer is browsing history; stop following.
  useEffect(() => {
    const onPopState = () => setFollowing(false);
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    if (following && liveTaxon && liveTaxon !== displayedTaxon) {
      router.push(taxonHref(liveTaxon));
    }
  }, [following, liveTaxon, displayedTaxon, router]);

  const showJump =
    following === false && !!liveTaxon && liveTaxon !== displayedTaxon;

  return (
    <>
      {disconnected && (
        <Affix position={{ top: 16, right: 16 }}>
          <Tooltip label="Disconnected from live updates">
            <ThemeIcon variant="default" radius="xl" size="lg">
              <WifiSlashIcon size={18} aria-label="Disconnected" />
            </ThemeIcon>
          </Tooltip>
        </Affix>
      )}
      {showJump && (
        // Room for the affixed button so it doesn't cover the end of the page.
        <Box h={JUMP_BUTTON_SPACE} />
      )}
      {showJump && (
        <Affix position={{ bottom: 16, left: 0, right: 0 }}>
          {/* Match the page's container so the button lines up with its content. */}
          <Container size="sm">
            <Button
              fullWidth
              size="sm"
              radius="xl"
              variant="default"
              leftSection={<FastForwardIcon size={18} />}
              onClick={() => {
                setFollowing(true);
                router.push(taxonHref(liveTaxon));
              }}
            >
              Jump to present
            </Button>
          </Container>
        </Affix>
      )}
    </>
  );
}
