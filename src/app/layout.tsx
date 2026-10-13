import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { productConfig } from "@/config/product";
import { UiPreferencesProvider } from "@/components/ui-preferences";
import { getUiPreferences } from "@/lib/ui/server-preferences";
import { localeDirection } from "@/lib/ui/preferences";

export const metadata: Metadata = {
  title: productConfig.name,
  description: productConfig.description,
  icons: {
    icon: [
      { url: "/brand/scanvoro-mark.svg", type: "image/svg+xml" },
      { url: "/brand/scanvoro-app.png", type: "image/png", sizes: "512x512" },
    ],
    apple: {
      url: "/brand/scanvoro-apple.png",
      sizes: "180x180",
      type: "image/png",
    },
  },
};

export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  const preferences = await getUiPreferences();
  return (
    <html
      lang={preferences.locale}
      dir={localeDirection(preferences.locale)}
      data-theme={preferences.theme}
    >
      <body>
        <UiPreferencesProvider initial={preferences}>
          {children}
        </UiPreferencesProvider>
      </body>
    </html>
  );
}
