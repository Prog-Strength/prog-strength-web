import type { Metadata } from "next";
import { Nunito, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { ToastProvider } from "@/components/toast";
import { DistanceUnitProvider } from "@/lib/distance-unit-context";

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Prog Strength",
  description: "Natural-language strength training tracker.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      // `dark` makes Tailwind's `dark:` variants resolve consistently
      // with our forced-dark palette in globals.css.
      className={`${nunito.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <body className="min-h-full flex flex-col bg-[var(--background)] text-[var(--foreground)]">
        <Providers>
          <ToastProvider>
            <DistanceUnitProvider>{children}</DistanceUnitProvider>
          </ToastProvider>
        </Providers>
      </body>
    </html>
  );
}
