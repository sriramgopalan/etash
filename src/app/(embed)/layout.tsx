import type { ReactNode } from "react";

import { TrpcProvider } from "@/components/providers/TrpcProvider";

import "../globals.css";

export default function EmbedLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body className="font-sans">
        <TrpcProvider>{children}</TrpcProvider>
      </body>
    </html>
  );
}
