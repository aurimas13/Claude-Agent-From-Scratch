import type { Metadata, Viewport } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import { HumanGate } from "@/components/HumanGate";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Agent From Scratch", template: "%s · Agent From Scratch" },
  description:
    "A ReAct AI agent built from scratch on the Claude API. Watch it think, use tools (calculator, weather, world clock, web search) and answer, step by step.",
  openGraph: {
    title: "Agent From Scratch",
    description: "Watch an AI agent think, use tools and answer, step by step.",
    type: "website",
  },
};

export const viewport: Viewport = { themeColor: "#fafaff", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="min-h-dvh font-sans antialiased">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-3 focus:py-2 focus:shadow">
          Skip to content
        </a>
        <HumanGate>
          <SiteHeader />
          <main id="main">{children}</main>
          <SiteFooter />
        </HumanGate>
      </body>
    </html>
  );
}
