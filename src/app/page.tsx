"use client";

import { useState } from "react";
import { EvmChainId, type SushiSwapV3ChainId } from "sushi/evm";
import type { Address } from "viem";
import { AddressInput, NetworkSelector } from "@/components";
import PoolHeader from "@/components/pool-header";
import { TickChart } from "@/components/tick-chart";

export default function Page() {
  const [address, setAddress] = useState<Address | undefined>('0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640');
  const [chainId, setChainId] = useState<SushiSwapV3ChainId>(
    EvmChainId.ETHEREUM,
  );

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-b from-slate-50 to-white">
      <div className="w-full max-w-3xl bg-white/90 dark:bg-slate-900/75 backdrop-blur-sm rounded-2xl shadow-lg border border-slate-100 dark:border-slate-800 p-6">
        <header className="mb-6 text-center">
          <h1 className="m-0 text-2xl sm:text-3xl font-semibold text-slate-800 dark:text-slate-100">
            V3 Charts
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Enter an address and select a network to view your liquidity charts.
          </p>
        </header>

        <section className="flex gap-4 items-start flex-wrap h-[120px] mb-2">
          <div className="flex flex-col min-w-[220px] flex-1">
            <label
              htmlFor="address"
              className="text-xs mb-1.5 text-slate-600 dark:text-slate-400"
            >
              Address
            </label>
            <AddressInput
              value={address}
              onChange={setAddress}
              className="w-full rounded-md border border-slate-200 dark:border-slate-700 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-300 dark:focus:ring-sky-600"
            />
          </div>

          <div className="flex flex-col min-w-[220px] flex-1">
            <label
              htmlFor="network"
              className="text-xs mb-1.5 text-slate-600 dark:text-slate-400"
            >
              Network
            </label>
            <NetworkSelector
              value={chainId}
              onChange={setChainId}
              className="w-full rounded-md border border-slate-200 dark:border-slate-700 px-3 py-2 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-300 dark:focus:ring-sky-600"
            />
          </div>
        </section>
        <section className="min-h-[320px] flex flex-col gap-8">
          <PoolHeader chainId={chainId} address={address} />
          <TickChart chainId={chainId} address={address} />
        </section>
      </div>
    </main>
  );
}
