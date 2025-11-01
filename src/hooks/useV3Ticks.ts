import { useMemo } from "react";
import {
  computeSushiSwapV3PoolAddress,
  nearestUsableTick,
  SUSHISWAP_V3_TICK_LENS,
  type SushiSwapV3ChainId,
  type SushiSwapV3Pool,
} from "sushi/evm";
import type { Address } from "viem/accounts";
import { useReadContracts } from "wagmi";
import type { util } from "zod";

const bitmapIndex = (tick: number, tickSpacing: number) => {
  return Math.floor(tick / tickSpacing / 256);
};

const getPopulatedTicksInWordAbiShard = [
  {
    inputs: [
      { internalType: "address", name: "pool", type: "address" },
      {
        internalType: "int16",
        name: "tickBitmapIndex",
        type: "int16",
      },
    ],
    name: "getPopulatedTicksInWord",
    outputs: [
      {
        components: [
          { internalType: "int24", name: "tick", type: "int24" },
          {
            internalType: "int128",
            name: "liquidityNet",
            type: "int128",
          },
          {
            internalType: "uint128",
            name: "liquidityGross",
            type: "uint128",
          },
        ],
        internalType: "struct ITickLens.PopulatedTick[]",
        name: "populatedTicks",
        type: "tuple[]",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
] as const;

export function useV3Ticks({
  chainId,
  pool,
  poolAddress,
  numSurroundingTicks = 1250,
  enabled = true,
}: {
  chainId: SushiSwapV3ChainId;
  pool: SushiSwapV3Pool | undefined;
  poolAddress: Address | undefined;
  numSurroundingTicks?: number;
  enabled?: boolean;
}) {
  const tickSpacing = pool?.tickSpacing;

  const activeTick =
    typeof pool?.tickCurrent === "number" && tickSpacing
      ? nearestUsableTick(pool?.tickCurrent, tickSpacing)
      : undefined;

  const minIndex = useMemo(
    () =>
      tickSpacing !== undefined && activeTick !== undefined
        ? bitmapIndex(
            activeTick - numSurroundingTicks * tickSpacing,
            tickSpacing,
          )
        : undefined,
    [tickSpacing, activeTick, numSurroundingTicks],
  );
  const maxIndex = useMemo(
    () =>
      tickSpacing !== undefined && activeTick !== undefined
        ? bitmapIndex(
            activeTick + numSurroundingTicks * tickSpacing,
            tickSpacing,
          )
        : undefined,
    [tickSpacing, activeTick, numSurroundingTicks],
  );

  const contractReads = useMemo(() => {
    const reads = [];
    if (
      typeof minIndex === "number" &&
      typeof maxIndex === "number" &&
      typeof poolAddress === "string"
    ) {
      for (let i = minIndex; i <= maxIndex; i++) {
        reads.push({
          address: SUSHISWAP_V3_TICK_LENS[chainId],
          abi: getPopulatedTicksInWordAbiShard,
          chainId,
          functionName: "getPopulatedTicksInWord",
          args: [poolAddress as Address, i],
        } as const);
      }
    }
    return reads;
  }, [chainId, maxIndex, minIndex, poolAddress]);

  const reads = useReadContracts({
    contracts: contractReads,
    allowFailure: false,
    query: {
      enabled: true,
    },
  });

  return useMemo(() => {
    const { data } = reads;

    const reduced = data?.reduce((ticks, word) => {
      return ticks.concat(word);
    }, []);
    const renamed = (reduced as util.Writeable<typeof reduced>)?.map(
      (tick) => ({
        tickIdx: tick.tick,
        liquidityNet: tick.liquidityNet,
      }),
    );
    const sorted = renamed?.sort((a, b) => a.tickIdx - b.tickIdx);

    return {
      ...reads,
      data: sorted,
    };
  }, [reads]);
}
