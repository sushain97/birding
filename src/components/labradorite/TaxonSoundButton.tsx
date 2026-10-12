"use client";

import { useEffect, useRef, useState } from "react";
import { ActionIcon, Tooltip } from "@mantine/core";
import { SpeakerHighIcon } from "@phosphor-icons/react";
import type { XenoCantoSound } from "@/lib/xeno-canto/client";

export function TaxonSoundButton({ sound }: { sound: XenoCantoSound }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);

  // Stop when navigating to another taxon.
  useEffect(() => {
    const audio = audioRef.current;
    return () => audio?.pause();
  }, [sound.url]);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      audio.currentTime = 0;
    } else {
      void audio.play();
    }
  };

  return (
    <>
      <audio
        ref={audioRef}
        src={sound.url}
        preload="none"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
      />
      <Tooltip label={sound.attribution}>
        <ActionIcon
          variant={playing ? "light" : "subtle"}
          color={playing ? undefined : "gray"}
          size="lg"
          radius="xl"
          onClick={toggle}
          aria-label={playing ? "Stop sound" : "Play sound"}
        >
          <SpeakerHighIcon size={22} weight={playing ? "fill" : "regular"} />
        </ActionIcon>
      </Tooltip>
    </>
  );
}
