import type { ReactNode } from "react";
import { QueryClientProvider, WagmiProvider } from "@/providers";

export const Providers = ({ children }: { children: ReactNode }) => {
  return (
    <QueryClientProvider>
      <WagmiProvider>{children}</WagmiProvider>
    </QueryClientProvider>
  );
};
