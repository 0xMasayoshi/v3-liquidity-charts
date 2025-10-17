import { useQuery } from "@tanstack/react-query";
import { Amount } from "sushi";
import {
  erc20Abi_balanceOf,
  erc20Abi_decimals,
  erc20Abi_symbol,
  EvmToken,
  SUSHISWAP_V3_FACTORY_ADDRESS,
  SushiSwapV3Pool,
  sushiSwapV3PoolAbi_factory,
  sushiSwapV3PoolAbi_fee,
  sushiSwapV3PoolAbi_liquidity,
  sushiSwapV3PoolAbi_slot0,
  sushiSwapV3PoolAbi_tickSpacing,
  sushiSwapV3PoolAbi_token0,
  sushiSwapV3PoolAbi_token1,
  type SushiSwapV3ChainId,
} from "sushi/evm";
import { isAddressEqual } from "viem";
import type { Address } from "viem/accounts";
import { usePublicClient } from "wagmi";

export const useV3Pool = ({
  address,
  chainId,
}: {
  address: Address | undefined;
  chainId: SushiSwapV3ChainId;
}) => {
  const client = usePublicClient({ chainId });
  return useQuery({
    enabled: Boolean(address),
    queryKey: ["v3-pool", address, chainId],
    queryFn: async () => {
      if (!address) throw new Error(null as never);
      const poolMulticall = await client?.multicall({
        contracts: [
          {
            address,
            abi: sushiSwapV3PoolAbi_factory,
            functionName: "factory",
          },
          {
            address,
            abi: sushiSwapV3PoolAbi_token0,
            functionName: "token0",
          },
          {
            address,
            abi: sushiSwapV3PoolAbi_token1,
            functionName: "token1",
          },
          {
            address,
            abi: sushiSwapV3PoolAbi_fee,
            functionName: "fee",
          },
          {
            address,
            abi: sushiSwapV3PoolAbi_tickSpacing,
            functionName: "tickSpacing",
          },
          {
            address,
            abi: sushiSwapV3PoolAbi_slot0,
            functionName: "slot0",
          },
          {
            address,
            abi: sushiSwapV3PoolAbi_liquidity,
            functionName: "liquidity",
          },
        ],
      });

      const factory = poolMulticall?.[0]?.result;
      const isSushi = factory
        ? isAddressEqual(factory, SUSHISWAP_V3_FACTORY_ADDRESS[chainId])
        : undefined;

      const token0Address = poolMulticall?.[1]?.result;
      const token1Address = poolMulticall?.[2]?.result;

      const fee = poolMulticall?.[3]?.result;
      const tickSpacing = poolMulticall?.[4]?.result;
      const _slot0 = poolMulticall?.[5]?.result;
      const sqrtPriceX96 = _slot0?.[0];
      const tickCurrent = _slot0?.[1];
      const liquidity = poolMulticall?.[6]?.result;

      const tokenMulticall =
        token0Address && token1Address
          ? await client?.multicall({
              contracts: [
                {
                  address: token0Address,
                  abi: erc20Abi_symbol,
                  functionName: "symbol",
                },
                {
                  address: token0Address,
                  abi: erc20Abi_decimals,
                  functionName: "decimals",
                },
                {
                  address: token0Address,
                  abi: erc20Abi_balanceOf,
                  functionName: "balanceOf",
                  args: [address],
                },
                {
                  address: token1Address,
                  abi: erc20Abi_symbol,
                  functionName: "symbol",
                },
                {
                  address: token1Address,
                  abi: erc20Abi_decimals,
                  functionName: "decimals",
                },
                {
                  address: token1Address,
                  abi: erc20Abi_balanceOf,
                  functionName: "balanceOf",
                  args: [address],
                },
              ],
            })
          : undefined;

      const token0Symbol = tokenMulticall?.[0]?.result;
      const token0Decimals = tokenMulticall?.[1]?.result;
      const token0Balance = tokenMulticall?.[2]?.result;
      const token1Symbol = tokenMulticall?.[3]?.result;
      const token1Decimals = tokenMulticall?.[4]?.result;
      const token1Balance = tokenMulticall?.[5]?.result;

      const token0 =
        token0Address && token0Symbol && token0Decimals
          ? new EvmToken({
              chainId,
              address: token0Address,
              symbol: token0Symbol,
              decimals: token0Decimals,
              name: token0Symbol,
            })
          : undefined;

      const token1 =
        token1Address && token1Symbol && token1Decimals
          ? new EvmToken({
              chainId,
              address: token1Address,
              symbol: token1Symbol,
              decimals: token1Decimals,
              name: token1Symbol,
            })
          : undefined;

      return token0 && token1 && fee && sqrtPriceX96 && liquidity && tickCurrent
        ? {
            pool: new SushiSwapV3Pool(
              token0,
              token1,
              fee,
              sqrtPriceX96,
              liquidity?.toString(),
              tickCurrent,
            ),
            factory,
            token0Balance:
              token0 && token0Balance
                ? new Amount(token0, token0Balance)
                : undefined,
            token1Balance:
              token1 && token1Balance
                ? new Amount(token1, token1Balance)
                : undefined,
          }
        : undefined;
    },
  });
};
