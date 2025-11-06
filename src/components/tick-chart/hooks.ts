import { useQuery } from "@tanstack/react-query";
import { Amount } from "sushi";
import {
  type EvmToken,
  type SushiSwapV3ChainId,
  type SushiSwapV3FeeAmount,
  TICK_SPACINGS,
  TickMath,
  tickToPrice,
} from "sushi/evm";
import { type Address, stringify } from "viem";
import type { ChartEntry } from "./types";
import { type TickProcessed, useV3ActiveLiquidity, useV3Pool } from "@/hooks";

// function getCurrentTickAmounts({
//   currentTick,
//   sqrtPriceX96,
//   liquidityActive,
//   tickSpacing,
// }: {
//   currentTick: number
//   sqrtPriceX96: bigint
//   liquidityActive: bigint
//   tickSpacing: number
// }) {
//   const Q96 = BigInt(2) ** BigInt(96)
//   const lowerTick = Math.floor(currentTick / tickSpacing) * tickSpacing
//   const upperTick = lowerTick + tickSpacing

//   const sqrtLower = TickMath.getSqrtRatioAtTick(lowerTick)
//   const sqrtUpper = TickMath.getSqrtRatioAtTick(upperTick)

//   // Clamp in case price is slightly outside bounds
//   let sqrtP = sqrtPriceX96
//   if (sqrtP < sqrtLower) sqrtP = sqrtLower
//   if (sqrtP > sqrtUpper) sqrtP = sqrtUpper

//   // token0 = part above current price
//   const amount0Raw =
//     (liquidityActive * (sqrtUpper - sqrtP) * Q96) /
//     (sqrtUpper * sqrtP)

//   // token1 = part below current price
//   const amount1Raw =
//     (liquidityActive * (sqrtP - sqrtLower)) /
//     Q96

//   return { amount0Raw, amount1Raw }
// }

async function calculateActiveRangeTokensLocked({
  token0,
  token1,
  feeAmount,
  tick,
  poolData,
}: {
  token0: EvmToken;
  token1: EvmToken;
  feeAmount: SushiSwapV3FeeAmount;
  tick: TickProcessed;
  poolData: {
    sqrtPriceX96?: bigint;
    currentTick: number;
    liquidity: bigint;
  };
}): Promise<{ amount0Locked: number; amount1Locked: number } | undefined> {
  try {
    const tickSpacing = TICK_SPACINGS[feeAmount];
    const lower = tick.tick;
    const upper = lower + tickSpacing;

    const Q96 = BigInt(2) ** BigInt(96)
    const sqrtA = TickMath.getSqrtRatioAtTick(lower) // Q96
    const sqrtB = TickMath.getSqrtRatioAtTick(upper) // Q96
    let sqrtP = poolData.sqrtPriceX96 as bigint      // Q96
    const liquidity = tick.liquidityActive           // Q0

    // Clamp just in case current sqrt is slightly out of [A,B] due to rounding
    if (sqrtP < sqrtA) sqrtP = sqrtA
    if (sqrtP > sqrtB) sqrtP = sqrtB

    const d0 = sqrtB - sqrtP
    const d1 = sqrtP - sqrtA

    // split the active interval at current price:
    // token0 = inventory in (P, B]
    // token1 = inventory in [A, P)
    const amount0Raw = (liquidity * d0 * Q96) / (sqrtB * sqrtP);
    const amount1Raw = (liquidity * d1) / Q96;

    const amount0Locked = +new Amount(token0, amount0Raw).toString({fixed: 8})
    const amount1Locked = +new Amount(token1, amount1Raw).toString({fixed: 8})

    return { amount0Locked, amount1Locked }
  } catch {
    return { amount0Locked: 0, amount1Locked: 0 };
  }
}

async function calculateTokensLocked({
  token0,
  token1,
  feeAmount,
  tick,
}: {
  token0: EvmToken;
  token1: EvmToken;
  feeAmount: SushiSwapV3FeeAmount;
  tick: TickProcessed;
}) {
  try {
    const tickSpacing = TICK_SPACINGS[feeAmount];
    const lower = tick.tick;
    const upper = tick.tick + tickSpacing;

    const Q96 = BigInt(1) << BigInt(96)
    const sqrtA = TickMath.getSqrtRatioAtTick(lower) // Q96
    const sqrtB = TickMath.getSqrtRatioAtTick(upper) // Q96
    const liquidity = tick.liquidityActive           // Q0

    const delta = sqrtB - sqrtA
    // inventory inside [lower, upper) (round-down like core math)
    const amount0Raw = (liquidity * delta * Q96) / (sqrtB * sqrtA); // L*Q96*(B-A)/(B*A)
    const amount1Raw = (liquidity * delta) / Q96;                   // L*(B-A)/Q96

    const amount0Locked = parseFloat(new Amount(token0, amount0Raw).toString({ fixed: 8 }))
    const amount1Locked = parseFloat(new Amount(token1, amount1Raw).toString({ fixed: 8 }))

    return { amount0Locked, amount1Locked }
  } catch {
    return { amount0Locked: 0, amount1Locked: 0 };
  }
}

interface UseTickChartData {
  chainId: SushiSwapV3ChainId;
  address: Address | undefined;
  enabled?: boolean;
}

export function useTickChartData({
  chainId,
  address,
  enabled = true,
}: UseTickChartData) {
  const { data, isLoading: _isPoolLoading } = useV3Pool({ address, chainId });
  const { pool } = data ?? { pool: undefined, factory: undefined };

  const activeLiquidityQuery = useV3ActiveLiquidity({
    chainId,
    address,
    enabled,
  });

  const liquidityTicksChartQuery = useQuery({
    enabled: enabled && !!activeLiquidityQuery.data && !!pool,
    queryKey: [
      "v3-ticks-chart",
      {
        chainId,
        pool: `${pool?.chainId}:${pool?.token0.address}/${pool?.token1.address}/${pool?.fee}`,
        length: activeLiquidityQuery.data?.length,
        currentTick: activeLiquidityQuery.currentTick,
        liquidity: activeLiquidityQuery.liquidity,
        sqrtPriceX96: activeLiquidityQuery.sqrtPriceX96,
        activeTick: activeLiquidityQuery.activeTick,
      },
    ],
    queryKeyHashFn: stringify,
    queryFn: async () => {
      if (!activeLiquidityQuery.data || !pool) throw new Error(null as never);

      const isReversed = false; // xxTODO

      let activeRangePercentage: number | undefined = undefined;
      let activeRangeIndex: number | undefined = undefined;

      const chartData = await Promise.all(
        activeLiquidityQuery.data.map(async (tick, index) => {
          const isActive = activeLiquidityQuery.activeTick === tick.tick;

          let price0 = tickToPrice(pool.token0, pool.token1, tick.tick);
          let price1 = price0.invert();

          if (
            isActive &&
            activeLiquidityQuery.activeTick &&
            activeLiquidityQuery.currentTick
          ) {
            activeRangeIndex = index;
            activeRangePercentage =
              (activeLiquidityQuery.currentTick - tick.tick) / pool.tickSpacing;

            price0 = tickToPrice(pool.token0, pool.token1, tick.tick);
            price1 = price0.invert();
          }

          const { amount0Locked, amount1Locked } = await calculateTokensLocked({
            token0: pool.token0,
            token1: pool.token1,
            feeAmount: pool.fee,
            tick,
          });

          return {
            tick: tick.tick,
            liquidity: Number(tick.liquidityActive),
            price0: +price0.toSignificant(),
            price1: +price1.toSignificant(),
            amount0Locked,
            amount1Locked,
          } satisfies ChartEntry;
        }),
      );

      const activeRangeData =
        activeRangeIndex !== undefined
          ? chartData[activeRangeIndex]
          : undefined;

      // For active range, adjust amounts locked to adjust for where current tick/price is within the range
      if (activeRangeIndex !== undefined && activeRangeData) {
        const activeTickTvl = await calculateActiveRangeTokensLocked({
          token0: pool.token0,
          token1: pool.token1,
          feeAmount: pool.fee,
          tick: activeLiquidityQuery.data[activeRangeIndex],
          poolData: {
            currentTick: activeLiquidityQuery.currentTick,
            liquidity: activeLiquidityQuery.liquidity,
            sqrtPriceX96: activeLiquidityQuery.sqrtPriceX96,
          },
        });
        chartData[activeRangeIndex] = { ...activeRangeData, ...activeTickTvl };
      }

      // Reverse data so that token0 is on the left by default
      if (!isReversed) {
        chartData.reverse();
      }

      return {
        chartData: chartData.filter((t) => t.liquidity > 0),
        activeRangeData,
        activeRangePercentage,
      };
    },
  });

  return {
    tickData: liquidityTicksChartQuery.data,
    activeTick: activeLiquidityQuery.activeTick,
    isLoading:
      activeLiquidityQuery.isLoading ||
      liquidityTicksChartQuery.isLoading ||
      !liquidityTicksChartQuery.data,
    isError: liquidityTicksChartQuery.error || activeLiquidityQuery.error,
  };
}
