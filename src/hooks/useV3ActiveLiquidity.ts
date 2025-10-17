import {
    type EvmToken,
  TICK_SPACINGS,
  tickToPrice,
  type SushiSwapV3ChainId,
  type SushiSwapV3FeeAmount,
} from "sushi/evm";
import type { Address } from "viem";
import { useV3Pool } from "./useV3Pool";
import { useMemo } from "react";
import { useV3Ticks } from "./useV3Ticks";
import { Price } from "sushi";

// Computes the numSurroundingTicks above or below the active tick.
function computeSurroundingTicks(
  token0: EvmToken,
  token1: EvmToken,
  activeTickProcessed: TickProcessed,
  sortedTickData: NonNullable<ReturnType<typeof useV3Ticks>['data']>,
  pivot: number,
  ascending: boolean,
): TickProcessed[] {
  let previousTickProcessed: TickProcessed = {
    ...activeTickProcessed,
  }
  // Iterate outwards (either up or down depending on direction) from the active tick,
  // building active liquidity for every tick.
  let processedTicks: TickProcessed[] = []
  for (
    let i = pivot + (ascending ? 1 : -1);
    ascending ? i < sortedTickData.length : i >= 0;
    ascending ? i++ : i--
  ) {
    const tick = Number(sortedTickData[i].tickIdx)
    const sdkPrice = tickToPrice(token0, token1, tick)
    const currentTickProcessed: TickProcessed = {
      liquidityActive: previousTickProcessed.liquidityActive,
      tick,
      liquidityNet: sortedTickData[i].liquidityNet,
      price0: sdkPrice.toString({
        fixed: 8 //PRICE_FIXED_DIGITS,
      }),
      sdkPrice
    }

    // Update the active liquidity.
    // If we are iterating ascending and we found an initialized tick we immediately apply
    // it to the current processed tick we are building.
    // If we are iterating descending, we don't want to apply the net liquidity until the following tick.
    if (ascending) {
      currentTickProcessed.liquidityActive =
        previousTickProcessed.liquidityActive + sortedTickData[i].liquidityNet
    } else if (!ascending && previousTickProcessed.liquidityNet !== BigInt(0)) {
      // We are iterating descending, so look at the previous tick and apply any net liquidity.
      currentTickProcessed.liquidityActive =
        previousTickProcessed.liquidityActive -
        previousTickProcessed.liquidityNet
    }

    processedTicks.push(currentTickProcessed)
    previousTickProcessed = currentTickProcessed
  }

  if (!ascending) {
    processedTicks = processedTicks.reverse()
  }

  return processedTicks
}

export interface TickProcessed {
  tick: number;
  liquidityActive: bigint;
  liquidityNet: bigint;
  price0: string;
  sdkPrice: Price<EvmToken, EvmToken>
}

const getActiveTick = (
  tickCurrent: number | undefined,
  feeAmount: SushiSwapV3FeeAmount | undefined,
) =>
  tickCurrent !== undefined && feeAmount
    ? Math.floor(tickCurrent / TICK_SPACINGS[feeAmount]) *
      TICK_SPACINGS[feeAmount]
    : undefined;

export const useV3ActiveLiquidity = ({
  address,
  chainId,
  enabled = true
}: {
  address: Address | undefined;
  chainId: SushiSwapV3ChainId;
  enabled?: boolean
}) => {
  const { data, isLoading: isPoolLoading } = useV3Pool({ address, chainId });
  const { pool, factory } = data ?? { pool: undefined, factory: undefined };

  // Find nearest valid tick for pool in case tick is not initialized.
  const activeTick = useMemo(
    () => getActiveTick(pool?.tickCurrent, pool?.fee),
    [pool],
  );

  const {
    isLoading,
    error,
    data: ticks,
  } = useV3Ticks({ pool, factory, chainId });

  return useMemo(() => {
    if (
      activeTick === undefined ||
      !pool ||
      !ticks ||
      ticks.length === 0 ||
      isLoading
    ) {
      return {
        isLoading: isLoading || isPoolLoading,
        error,
        activeTick,
        data: undefined,
      }
    }

    const _token0 = pool.token0
    const _token1 = pool.token1

    // find where the active tick would be to partition the array
    // if the active tick is initialized, the pivot will be an element
    // if not, take the previous tick as pivot
    const pivot = ticks.findIndex(({ tickIdx }) => tickIdx > activeTick) - 1

    if (pivot < 0) {
      // consider setting a local error
      console.error('TickData pivot not found')
      return {
        isLoading,
        error,
        activeTick,
        data: undefined,
      }
    }

    const sdkPrice = tickToPrice(_token0, _token1, activeTick)

    const activeTickProcessed: TickProcessed = {
      liquidityActive: BigInt(pool?.liquidity.toString()) ?? BigInt(0),
      tick: activeTick,
      liquidityNet:
        Number(ticks[pivot].tickIdx) === activeTick
          ? ticks[pivot].liquidityNet
          : BigInt(0),
      price0: sdkPrice.toString({
        fixed: 8 //PRICE_FIXED_DIGITS,
      }),
      sdkPrice,
    }

    const subsequentTicks = computeSurroundingTicks(
      _token0,
      _token1,
      activeTickProcessed,
      ticks,
      pivot,
      true,
    )
    const previousTicks = computeSurroundingTicks(
      _token0,
      _token1,
      activeTickProcessed,
      ticks,
      pivot,
      false,
    )
    const ticksProcessed = previousTicks
      .concat(activeTickProcessed)
      .concat(subsequentTicks)

    return {
      isLoading,
      error,
      currentTick: pool.tickCurrent,
      activeTick,
      liquidity: pool.liquidity,
      sqrtPriceX96: pool.sqrtRatioX96,
      data: ticksProcessed,
    }
  }, [activeTick, pool, ticks, isLoading, error, isPoolLoading])
};
