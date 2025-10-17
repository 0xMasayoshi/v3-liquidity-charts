"use client";

import { useState } from "react";
import { EvmChainId, type SushiSwapV3ChainId } from "sushi/evm";
import type { Address } from "viem";
import { AddressInput, NetworkSelector } from "@/components";
import { useV3Pool } from "@/hooks";

export default function Page() {
  const [address, setAddress] = useState<Address | undefined>();
  const [network, setNetwork] = useState<SushiSwapV3ChainId>(
    EvmChainId.ETHEREUM,
  );

  const { data } = useV3Pool({ chainId: network, address });

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
              value={network}
              onChange={setNetwork}
              className="w-full rounded-md border border-slate-200 dark:border-slate-700 px-3 py-2 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-300 dark:focus:ring-sky-600"
            />
          </div>
        </section>
        <section className="min-h-[320px] flex flex-col gap-8">
          <div className="flex flex-col min-w-[220px]">
              <div className="text-xs mb-1.5 text-slate-600 dark:text-slate-400">
                Pool
              </div>
              <div className="w-full rounded-md border border-slate-200 dark:border-slate-700 px-3 py-2 bg-white dark:bg-slate-800">
                {data && data.token0 && data.token1 ? (
                  <div className="flex flex-col">
                    <div className="text-sm font-medium text-slate-800 dark:text-slate-100">
                      {data.token0.symbol} / {data.token1.symbol}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Fee:&nbsp;
                      <span className="font-medium text-slate-700 dark:text-slate-200">
                        {typeof data.fee === "number"
                          ? `${(data.fee / 10000)
                              .toFixed(2)
                              .replace(/\.?0+$/, "")}%`
                          : "—"}
                      </span>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Tick: {data.slot0?.tick}
                    </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    No pool found
                  </div>
                )}
              </div>
            </div>
          <div className="h-full border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-lg flex items-center justify-center text-slate-400 dark:text-slate-500 p-6 text-center">
            <div>
              <p className="mb-2">
                Charts will go here — waiting for your implementation.
              </p>
              <p className="text-xs text-slate-400">
                Selected network:{" "}
                <span className="font-medium text-slate-700 dark:text-slate-200">
                  {network}
                </span>
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
