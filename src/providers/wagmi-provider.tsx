"use client";


import type { FC, ReactNode } from "react";
import { WagmiProvider as _WagmiProvider } from "wagmi";
import { getWagmiConfig, getWagmiInitialState } from "../config/wagmi";

export const WagmiProvider: FC<{
  children: ReactNode;
  cookie?: string | null;
}> = ({ children, cookie }) => {
  const initialState = getWagmiInitialState(cookie);

  return (
    <_WagmiProvider config={getWagmiConfig()} initialState={initialState}>
        {children}      
    </_WagmiProvider>
  );
};