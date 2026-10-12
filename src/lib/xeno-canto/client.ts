export interface XenoCantoSound {
  url: string;
  pageUrl: string;
  attribution: string;
}

interface Recording {
  id: string;
  rec: string;
  type: string;
  file: string;
  url: string;
  lic: string;
  length: string;
}

function lengthSeconds(length: string): number {
  return length.split(":").reduce((acc, part) => acc * 60 + Number(part), 0);
}

function licenseName(url: string): string {
  const match = /licenses\/([^/]+)\/([^/]+)/.exec(url);
  return match ? `CC ${match[1].toUpperCase()} ${match[2]}` : url;
}

export class XenoCantoClient {
  constructor(private readonly apiKey: string) {}

  async searchRecordings(query: string): Promise<Recording[]> {
    const params = new URLSearchParams({ query, key: this.apiKey });
    const response = await fetch(
      `https://xeno-canto.org/api/3/recordings?${params}`,
    );
    if (!response.ok) {
      throw new Error(`xeno-canto search failed: ${response.status}`);
    }
    return ((await response.json()) as { recordings: Recording[] }).recordings;
  }

  /** A short, top-quality recording of the species, preferring songs. */
  async getSpeciesSound(name: string): Promise<XenoCantoSound | undefined> {
    const [genus, species] = name.split(" ");
    if (!genus || !species) return undefined;

    for (const quality of ["A", "B"]) {
      const recordings = await this.searchRecordings(
        `gen:${genus} sp:${species} q:${quality}`,
      );
      const short = recordings.filter((r) => {
        const seconds = lengthSeconds(r.length);
        return seconds >= 5 && seconds <= 90;
      });
      const recording =
        short.find((r) => r.type.includes("song")) ??
        short.at(0) ??
        recordings.at(0);
      if (recording) {
        return {
          url: recording.file,
          pageUrl: recording.url,
          attribution: `${recording.rec}, XC${recording.id} (${licenseName(recording.lic)})`,
        };
      }
    }
    return undefined;
  }
}
