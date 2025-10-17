import { useQuery } from '@tanstack/react-query'
import { Amount } from 'sushi'
import {
  type EvmCurrency,
  type EvmToken,
  type SushiSwapV3ChainId,
  type SushiSwapV3FeeAmount,
  SushiSwapV3Pool,
  TICK_SPACINGS,
  TickMath,
  tickToPrice,
} from 'sushi/evm'
import { Address, maxUint128, stringify } from 'viem'
import type { ChartEntry } from './types'
import { TickProcessed, useV3ActiveLiquidity, useV3Pool } from '@/hooks'

async function calculateActiveRangeTokensLocked({
  token0,
  token1,
  feeAmount,
  tick,
  poolData,
}: {
  token0: EvmToken
  token1: EvmToken
  feeAmount: SushiSwapV3FeeAmount
  tick: TickProcessed
  poolData: {
    sqrtPriceX96?: bigint
    currentTick: number
    liquidity: bigint
  }
}): Promise<{ amount0Locked: number; amount1Locked: number } | undefined> {
  if (!poolData.currentTick || !poolData.sqrtPriceX96 || !poolData.liquidity) {
    return undefined
  }

  try {
    const liquidityGross =
      tick.liquidityNet >= BigInt(0) ? tick.liquidityNet : -tick.liquidityNet

    const mockTicks = [
      {
        index: tick.tick,
        liquidityGross,
        liquidityNet: -tick.liquidityNet,
      },
      {
        index: tick.tick + TICK_SPACINGS[feeAmount],
        liquidityGross,
        liquidityNet: tick.liquidityNet,
      },
    ]

    // Initialize pool containing only the active range
    const pool1 = new SushiSwapV3Pool(
      token0,
      token1,
      feeAmount,
      poolData.sqrtPriceX96,
      tick.liquidityActive,
      poolData.currentTick,
      mockTicks,
    )
    const tickPrice = tickToPrice(token0, token1, poolData.currentTick)

    // Calculate amount of token0 that would need to be swapped to reach the bottom of the range
    const bottomOfRangePrice = TickMath.getSqrtRatioAtTick(mockTicks[0].index)
    const maxAmountToken0 = new Amount(token0, maxUint128)

    const token1Amount = (
      await pool1.getOutputAmount(maxAmountToken0, bottomOfRangePrice)
    )[0]
    const amount0Locked = +tickPrice
      .invert()
      .getQuote(token1Amount)
      .toSignificant()

    // Calculate amount of token1 that would need to be swapped to reach the top of the range
    const topOfRangePrice = TickMath.getSqrtRatioAtTick(mockTicks[1].index)
    const maxAmountToken1 = new Amount(token1, maxUint128)
    const token0Amount = (
      await pool1.getOutputAmount(maxAmountToken1, topOfRangePrice)
    )[0]
    const amount1Locked = +tickPrice.getQuote(token0Amount).toSignificant()

    return { amount0Locked, amount1Locked }
  } catch {
    return { amount0Locked: 0, amount1Locked: 0 }
  }
}

async function calculateTokensLocked({
  token0,
  token1,
  feeAmount,
  tick,
}: {
  token0: EvmToken
  token1: EvmToken
  feeAmount: SushiSwapV3FeeAmount
  tick: TickProcessed
}) {
  try {
    const tickSpacing = TICK_SPACINGS[feeAmount]
    const liquidityNet = tick.liquidityNet
    const liquidityGross = liquidityNet >= BigInt(0) ? liquidityNet : -liquidityNet
    const sqrtPriceX96 = TickMath.getSqrtRatioAtTick(tick.tick)

    const mockTicks = [
      {
        index: tick.tick,
        liquidityGross,
        liquidityNet: -tick.liquidityNet,
      },
      {
        index: tick.tick + tickSpacing,
        liquidityGross,
        liquidityNet: tick.liquidityNet,
      },
    ]

    // Pool containing only the current range
    const pool = new SushiSwapV3Pool(
      token0,
      token1,
      feeAmount,
      sqrtPriceX96,
      tick.liquidityActive,
      tick.tick,
      mockTicks,
    )

    const nextSqrtX96 = TickMath.getSqrtRatioAtTick(tick.tick - tickSpacing)
    const maxAmountToken0 = new Amount(token0, maxUint128)
    const token1Amount = (
      await pool.getOutputAmount(maxAmountToken0, nextSqrtX96)
    )[0]

    const amount1Locked = parseFloat(token1Amount.toString())

    const amount0Locked = parseFloat(tick.sdkPrice
      .invert()
      .getQuote(token1Amount)
      .toString())

    return { amount0Locked, amount1Locked }
  } catch {
    return { amount0Locked: 0, amount1Locked: 0 }
  }
}

interface UseTickChartData {
  chainId: SushiSwapV3ChainId
  address: Address | undefined
  enabled?: boolean
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
  })

  const liquidityTicksChartQuery = useQuery({
    enabled:
      enabled &&
      !!activeLiquidityQuery.data &&
      !!pool,
    queryKey: [
      'v3-ticks-chart',
      {
        chainId,
        pool:`${pool?.chainId}:${pool?.token0.address}/${pool?.token1.address}/${pool?.fee}`,
        length: activeLiquidityQuery.data?.length,
        currentTick: activeLiquidityQuery.currentTick,
        liquidity: activeLiquidityQuery.liquidity,
        sqrtPriceX96: activeLiquidityQuery.sqrtPriceX96,
        activeTick: activeLiquidityQuery.activeTick,
      },
    ],
    queryKeyHashFn: stringify,
    queryFn: async () => {
      if (!activeLiquidityQuery.data || !pool)
        throw new Error(null as never)

      const isReversed = true // xxTODO (fuck you codex)

      let activeRangePercentage: number | undefined = undefined
      let activeRangeIndex: number | undefined = undefined

      const chartData = await Promise.all(
        activeLiquidityQuery.data.map(async (tick, index) => {
          // based on index
          const fakeTime = isReversed
            ? index * 1000
            : (activeLiquidityQuery.data.length - index) * 1000
          const isActive = activeLiquidityQuery.activeTick === tick.tick

          let price0 = tickToPrice(pool.token0, pool.token1, tick.tick)
          let price1 = price0.invert()

          if (
            isActive &&
            activeLiquidityQuery.activeTick &&
            activeLiquidityQuery.currentTick
          ) {
            activeRangeIndex = index
            activeRangePercentage =
              (activeLiquidityQuery.currentTick - tick.tick) /
              pool.tickSpacing

            price0 = tickToPrice(pool.token0, pool.token1, tick.tick)
            price1 = price0.invert()
          }

          const { amount0Locked, amount1Locked } = await calculateTokensLocked({
            token0: pool.token0,
            token1: pool.token1,
            feeAmount: pool.fee,
            tick,
          })

          return {
            tick: tick.tick,
            liquidity: Number(tick.liquidityActive),
            price0: +price0.toSignificant(),
            price1: +price1.toSignificant(),
            time: fakeTime,
            amount0Locked,
            amount1Locked,
          } satisfies ChartEntry
        }),
      )

      // offset previous bar with next bar’s locked amounts (Uniswap behavior)
      for (let i = 1; i < chartData.length; i++) {
        chartData[i - 1].amount0Locked = chartData[i].amount0Locked
        chartData[i - 1].amount1Locked = chartData[i].amount1Locked
      }

      const activeRangeData =
        activeRangeIndex !== undefined ? chartData[activeRangeIndex] : undefined

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
        })
        chartData[activeRangeIndex] = { ...activeRangeData, ...activeTickTvl }
      }

      // Reverse data so that token0 is on the left by default
      if (!isReversed) {
        chartData.reverse()
      }

      return {
        chartData: chartData.filter((t) => t.liquidity > 0),
        activeRangeData,
        activeRangePercentage,
      }
    },
  })

  return {
    tickData: liquidityTicksChartQuery.data,
    activeTick: activeLiquidityQuery.activeTick,
    isLoading:
      activeLiquidityQuery.isLoading ||
      liquidityTicksChartQuery.isLoading ||
      !liquidityTicksChartQuery.data,
    isError: liquidityTicksChartQuery.error || activeLiquidityQuery.error,
  }
}
