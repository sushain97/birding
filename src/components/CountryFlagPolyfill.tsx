"use client";

import { useEffect } from "react";
import { polyfillCountryFlagEmojis } from "country-flag-emoji-polyfill";

export function CountryFlagPolyfill() {
  useEffect(() => {
    polyfillCountryFlagEmojis();
  }, []);

  return null;
}
