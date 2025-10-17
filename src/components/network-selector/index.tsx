import React, { useMemo, useState } from "react";
import {
  EvmChainId,
  isSushiSwapV3ChainId,
  type SushiSwapV3ChainId,
  SushiSwapV3ChainIds,
} from "sushi/evm";

type Option = { key: string; id: number | string; label: string };

export type NetworkSelectorProps = {
  value?: SushiSwapV3ChainId;
  onChange?: (chainId: SushiSwapV3ChainId) => void;
  className?: string;
  placeholder?: string;
};

function normalizeChains(): Option[] {
  const chains = SushiSwapV3ChainIds;

  // If it's an array like [1, 137, ...]
  if (Array.isArray(chains)) {
    return chains.map((id) => ({ key: String(id), id, label: String(id) }));
  }

  // If it's an object like { MAINNET: 1, POLYGON: 137, ... }
  if (chains && typeof chains === "object") {
    return Object.entries(chains).map(([key, id]) => ({
      key,
      id,
      label: `${key} (${String(id)})`,
    }));
  }

  // Fallback: empty
  return [];
}

export function NetworkSelector({
  value = EvmChainId.ETHEREUM,
  onChange,
  className,
  placeholder = "Select network",
}: NetworkSelectorProps) {
  const options = useMemo(() => normalizeChains(), []);
  const [internal, setInternal] = useState<SushiSwapV3ChainId>(value);

  // keep internal state in sync when caller controls the value
  React.useEffect(() => {
    if (value) setInternal(value);
  }, [value]);

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const chainId = +e.target.value;
    if (isSushiSwapV3ChainId(chainId)) {
      setInternal(chainId);
      onChange?.(chainId);
    }
  }

  return (
    <select
      className={className}
      onChange={handleChange}
      value={internal}
      aria-label="Network selector"
    >
      <option value="">{placeholder}</option>
      {options.map((opt) => (
        <option key={opt.key} value={opt.id}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
