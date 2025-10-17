"use client";

import { createConfig } from "wagmi";
import { publicWagmiConfig } from "./public";

export const createProductionConfig = () => {
  return createConfig({
    ...publicWagmiConfig,
  });
};