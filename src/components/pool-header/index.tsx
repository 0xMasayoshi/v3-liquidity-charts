import { useMemo, type FC } from "react";
import { usePrices, useV3Pool } from "@/hooks";
import type { SushiSwapV3ChainId } from "sushi/evm";
import type { Address } from "viem/accounts";
import { formatUSD } from "sushi";

type Props = {
  chainId: SushiSwapV3ChainId;
  address: Address | undefined;
  className?: string;
};

const PoolHeader: FC<Props> = ({ chainId, address, className = "" }) => {
  const { data: poolData, isLoading, error } = useV3Pool({ chainId, address });
  const pool = poolData?.pool;
  const token0Balance = poolData?.token0Balance;
  const token1Balance = poolData?.token1Balance;

  const { data: prices } = usePrices({ chainId });

  const { token0BalanceUSD, token1BalanceUSD } = useMemo(() => {
    if (!token0Balance || !token1Balance || !prices?.data)
      return { token0BalanceUSD: undefined, token1BalanceUSD: undefined };
    const token0Price = prices.data.getFraction(token0Balance.currency.address);
    const token1Price = prices.data.getFraction(token1Balance.currency.address);
    const token0BalanceUSD = token0Price
      ? token0Balance.mul(token0Price).toSignificant()
      : undefined;
    const token1BalanceUSD = token1Price
      ? token1Balance.mul(token1Price).toSignificant()
      : undefined;

    return {
      token0BalanceUSD,
      token1BalanceUSD,
    };
  }, [token0Balance, token1Balance, prices?.data]);

  return (
    <div className={`flex flex-col min-w-[220px] h-32 ${className}`}>
      <div className="text-xs mb-1.5 text-slate-600 dark:text-slate-400">
        Pool
      </div>

      <div className="w-full rounded-md border border-slate-200 dark:border-slate-700 px-3 py-2 bg-white dark:bg-slate-800">
        {isLoading ? (
          <div className="text-xs text-slate-500">Loading…</div>
        ) : error ? (
          <div className="text-xs text-rose-600">Failed to load pool</div>
        ) : pool?.token0 && pool?.token1 ? (
          <div className="flex flex-col">
            <div className="text-sm font-medium text-slate-800 dark:text-slate-100">
              {pool.token0.symbol} / {pool.token1.symbol}
            </div>

            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Fee:&nbsp;
              <span className="font-medium text-slate-700 dark:text-slate-200">
                {pool.fee / 10_000}%
              </span>
            </div>

            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Tick:&nbsp;
              <span className="font-medium text-slate-700 dark:text-slate-200">
                {typeof pool.tickCurrent === "number" ? pool.tickCurrent : "—"}
              </span>
            </div>

            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {pool.token0.symbol} balance:&nbsp;
              <span className="font-medium text-slate-700 dark:text-slate-200">
                {token0Balance ? token0Balance?.toSignificant() : "—"} (
                {formatUSD(token0BalanceUSD ?? '')})
              </span>
            </div>

            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {pool.token1.symbol} balance:&nbsp;
              <span className="font-medium text-slate-700 dark:text-slate-200">
                {token1Balance ? token1Balance?.toSignificant() : "—"} (
                {formatUSD(token1BalanceUSD ?? '')})
              </span>
            </div>
          </div>
        ) : (
          <div className="text-xs text-slate-500 dark:text-slate-400">
            No pool found
          </div>
        )}
      </div>
    </div>
  );
};

export default PoolHeader;
