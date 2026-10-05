import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { productConfig } from "@/config/product";

export const metadata: Metadata = {
  title: productConfig.name,
  description: productConfig.tagline,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
