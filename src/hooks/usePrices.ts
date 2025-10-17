import { useQuery } from "@tanstack/react-query";
import type { Address } from "viem";
import { parseUnits } from "viem";
import { Fraction, withoutScientificNotation } from "sushi";

export type PriceMap = {
  has: (address: Address) => boolean;
  get: (address: Address) => number | undefined;
  getFraction: (address: Address) => Fraction | undefined;
};

interface ApiPriceResponse {
  [address: string]: number;
}

export function usePrices({
  chainId,
  enabled = true,
}: {
  chainId?: number;
  enabled?: boolean;
}) {
  const queryKey = ["prices", chainId];

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      if (!chainId) throw new Error("No chainId provided");
      const res = await fetch(`https://api.sushi.com/price/v1/${chainId}`, {
        headers: { Accept: "application/json" },
      });
      if (!res.ok) {
        throw new Error(`Error fetching prices: ${res.status}`);
      }
      const data: ApiPriceResponse = await res.json();

      const priceMap = new Map<bigint, number>();
      for (const [addr, price] of Object.entries(data)) {
        priceMap.set(BigInt(addr), price);
      }

      const priceMapWrapper: PriceMap = {
        has: (address: Address) => priceMap.has(BigInt(address)),
        get: (address: Address) => priceMap.get(BigInt(address)),
        getFraction: (address: Address) => {
          const p = priceMap.get(BigInt(address));
          if (p === undefined) return undefined;
          const raw = withoutScientificNotation(String(p)) || "0";
          const numerator = parseUnits(raw, 18).toString();
          const denominator = parseUnits("1", 18).toString();
          return new Fraction({numerator, denominator});
        },
      };

      return {
        data: priceMapWrapper,
        lastModified: Date.now(),
      };
    },
    enabled: Boolean(chainId) && enabled,
    staleTime: 5 * 60 * 1000, // cache 5 minutes
    refetchOnWindowFocus: false,
  });

  return query;
}