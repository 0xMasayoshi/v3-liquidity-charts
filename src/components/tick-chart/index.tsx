"use client";

import type { EChartsOption } from "echarts";
import ReactEChartsCore from "echarts-for-react/lib/core";
import { BarChart } from "echarts/charts";
import { GridComponent, TooltipComponent } from "echarts/components";
import * as echarts from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import type { TopLevelFormatterParams } from "echarts/types/src/component/tooltip/TooltipModel.js";
import type {
  CallbackDataParams,
  TooltipFormatterCallback,
} from "echarts/types/src/util/types.js";
import React, { type FC, useCallback, useMemo } from "react";
import { formatUSD } from "sushi";
import type {
  EvmCurrency,
  SushiSwapV3ChainId,
  SushiSwapV3FeeAmount,
} from "sushi/evm";
import type { ChartEntry } from "./types";
import { useTickChartData } from "./hooks";
import { Address } from "viem/accounts";
import { usePrices, useV3Pool } from "@/hooks";

echarts.use([CanvasRenderer, BarChart, TooltipComponent, GridComponent]);

interface LiquidityChartProps {
  chainId: SushiSwapV3ChainId;
  address: Address | undefined;
}

export const TickChart: FC<LiquidityChartProps> = ({ chainId, address }) => {
  const { data, isLoading: _isPoolLoading } = useV3Pool({ address, chainId });
  const { pool } = data ?? { pool: undefined, factory: undefined };

  const {
    tickData: _tickData,
    isLoading,
    isError,
  } = useTickChartData({
    chainId,
    address,
  });

  const tickData = _tickData?.chartData;

  const onMouseOver = useCallback(
    (params) => {
      const [token0Data, token1Data] = params as (CallbackDataParams & {
        data: number;
      })[];

      const token0PriceNode = document.getElementById("token0Price");
      const token1PriceNode = document.getElementById("token1Price");

      const tick = tickData?.[token0Data.dataIndex].tick;
      const token0Price = tickData?.[token0Data.dataIndex].price0;
      const token1Price = tickData?.[token1Data.dataIndex].price1;
      const amount0Locked = tickData?.[token0Data.dataIndex].amount0Locked;
      const amount1Locked = tickData?.[token1Data.dataIndex].amount1Locked;

      if (token0PriceNode) token0PriceNode.innerHTML = `${token0Price}`;
      if (token1PriceNode) token1PriceNode.innerHTML = `${token1Price}`;

      const tvl = token0Data.data + token1Data.data;
      return `
            <div style="line-height:1.5">
            ${formatUSD(tvl)} <br/ >
              ${tick} <br/>
              <span style="color:#f472b6;">●</span> ${pool?.token0.symbol}: ${amount0Locked} (${formatUSD(token0Data.data)})<br/>
              <span style="color:#3b82f6;">●</span> ${pool?.token1.symbol}: ${amount1Locked} (${formatUSD(token1Data.data)})
              <br/>
            </div>`;
    },
    [tickData, pool?.token0.symbol, pool?.token1.symbol],
  ) satisfies TooltipFormatterCallback<TopLevelFormatterParams>;

  // const onMouseLeave = useCallback(() => {
  //   const tvlNode = document.getElementById('hoveredTVL')
  //   const dateNode = document.getElementById('hoveredTVLDate')

  //   if (tvlNode) tvlNode.innerHTML = formatUSD(latestTvl)
  //   if (dateNode)
  //     dateNode.innerHTML = format(new Date(latestDate), 'dd MMM yyyy HH:mm aa')
  // }, [latestTvl, latestDate])

  const { data: prices } = usePrices({ chainId });

  const option = useMemo<EChartsOption>(() => {
    const token0PriceUSD = pool?.token0.address
      ? prices?.data.get(pool.token0.address.toLowerCase() as Address)
      : undefined;
    const token1PriceUSD = pool?.token1.address
      ? prices?.data.get(pool.token1.address.toLowerCase() as Address)
      : undefined;

    // const token0Data = token0PriceUSD
    //   ? (tickData?.map((d) => d.amount0Locked * token0PriceUSD) ?? [])
    //   : []
    // const token1Data = token1PriceUSD
    //   ? (tickData?.map((d) => d.amount1Locked * token1PriceUSD) ?? [])
    //   : []

    const activeTick = _tickData?.activeRangeData?.tick;

    const token0Data = token0PriceUSD
      ? (tickData?.map((d) => {
          // below active => show token0; above active => zero; equal => keep both
          if (activeTick === undefined) return d.amount0Locked * token0PriceUSD;
          if (d.tick < activeTick) return d.amount0Locked * token0PriceUSD;
          if (d.tick > activeTick) return 0;
          // d.tick === activeTick
          return d.amount0Locked * token0PriceUSD;
        }) ?? [])
      : [];

    const token1Data = token1PriceUSD
      ? (tickData?.map((d) => {
          // above active => show token1; below active => zero; equal => keep both
          if (activeTick === undefined) return d.amount1Locked * token1PriceUSD;
          if (d.tick > activeTick) return d.amount1Locked * token1PriceUSD;
          if (d.tick < activeTick) return 0;
          // d.tick === activeTick
          return d.amount1Locked * token1PriceUSD;
        }) ?? [])
      : [];

    return {
      grid: { top: 0, left: 0, right: 0, bottom: 0 },
      tooltip: {
        trigger: "axis",
        formatter: onMouseOver,
      },
      xAxis: {
        type: "category",
      },
      yAxis: {
        show: false,
      },
      series: [
        {
          name: "token0",
          type: "bar",
          stack: "liquidity",
          data: token0Data,
          barWidth: 3,
          itemStyle: { color: "#f472b6", opacity: 0.9 }, // pink
        },
        {
          name: "token1",
          type: "bar",
          stack: "liquidity",
          data: token1Data,
          barWidth: 3,
          itemStyle: { color: "#3b82f6", opacity: 0.9 }, // blue
        },
      ],
    };
  }, [
    tickData,
    onMouseOver,
    prices?.data,
    pool?.token0.address,
    pool?.token1.address,
    _tickData?.activeRangeData?.tick,
  ]);

  return (
    <>
      <div>
        <div className="h-[22px]">
          {pool ? (
            <div className="flex flex-col gap-1 text-sm font-medium text-gray-600 dark:text-slate-300">
              <span>
                1 {pool?.token0.symbol} ={" "}
                <span id="token0Price">
                  {_tickData?.activeRangeData?.price0}
                </span>{" "}
                {pool?.token1.symbol}
              </span>
              <span>
                1 {pool?.token1.symbol} ={" "}
                <span id="token1Price">
                  {_tickData?.activeRangeData?.price1}
                </span>{" "}
                {pool?.token0.symbol}
              </span>
            </div>
          ) : null}
        </div>
      </div>
      <div>
        {isLoading ? (
          <div className="h-[400px] w-full bg-black/20 animate-pulse rounded-xl" />
        ) : isError ? (
          <div className="h-[400px] w-full" />
        ) : (
          <ReactEChartsCore
            echarts={echarts}
            option={option}
            style={{ height: 400 }}
          />
        )}
      </div>
    </>
  );
};
