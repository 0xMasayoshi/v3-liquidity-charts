import { useEffect, useState } from "react";
import { sz } from "sushi";
import type { Address } from "viem";

type Props = {
    value?: Address;
    onChange?: (address?: Address) => void;
    placeholder?: string;
    id?: string;
    className?: string;
};

export function AddressInput({
    value,
    onChange,
    placeholder = "0x...",
    id,
    className,
}: Props) {
    const [input, setInput] = useState<string>(value ?? "");
    const [validAddress, setValidAddress] = useState<Address | undefined>(
        value ?? undefined
    );
    const [error, setError] = useState<string | undefined>();

    // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
    useEffect(() => {
        // keep internal input in sync when external value changes
        if (value !== undefined && value !== validAddress) {
            setInput(value);
            setValidAddress(value);
            setError(undefined);
        } else if (value === undefined && validAddress !== undefined) {
            setInput("");
            setValidAddress(undefined);
            setError(undefined);
        }
       
    }, [value]);

    function validateAndEmit(next: string) {
        setInput(next);

        if (next === "") {
            setValidAddress(undefined);
            setError(undefined);
            onChange?.(undefined);
            return;
        }

        const result = sz.evm.address().safeParse(next);
        if (!result.success) {
            setValidAddress(undefined);
            // show the first zod error message
            setError(result.error.message);
            onChange?.(undefined);
            return;
        }

        const addr = result.data; // typed as Address
        setValidAddress(addr);
        setError(undefined);
        onChange?.(addr);
    }

    return (
        <div>
            <input
                id={id}
                value={input}
                onChange={(e) => validateAndEmit(e.target.value.trim())}
                placeholder={placeholder}
                className={className} 
                aria-invalid={!!error}
                aria-describedby={error ? `${id ?? "address-input"}-error` : undefined}
            />
            {error ? (
                <div
                    id={`${id ?? "address-input"}-error`}
                    style={{ color: "#e53e3e", marginTop: 6, fontSize: 13 }}
                >
                    {error}
                </div>
            ) : null}
        </div>
    );
}