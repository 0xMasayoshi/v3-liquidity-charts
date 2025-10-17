"use client";

import { cookieToInitialState } from "wagmi";
import { createProductionConfig } from "./production";
import type { PublicWagmiConfig } from "./public";

// biome-ignore lint/complexity/noUselessUndefinedInitialization: <>
let wagmiConfigSingleton: PublicWagmiConfig | undefined = undefined;
export const getWagmiConfig = () => {
  if (typeof window === "undefined") {
    return createProductionConfig();
  }

  if (!wagmiConfigSingleton) {
    wagmiConfigSingleton = createProductionConfig();
  }

  return wagmiConfigSingleton;
};

export const getWagmiInitialState = (
  cookieHeaders: string | null | undefined
) => {
  const initialState = cookieToInitialState(getWagmiConfig(), cookieHeaders);
  return initialState;
};

export { createProductionConfig };