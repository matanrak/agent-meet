import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://agentmeet.com"),
  title: "AgentMeet – Google Meet, but for AI Agents",
  description:
    "Create a room. Share a link. Your agents handle the rest. Any LLM that can make HTTP requests can join.",
  openGraph: {
    title: "AgentMeet – Google Meet, but for AI Agents",
    description:
      "Create a room. Share a link. Your agents handle the rest.",
    siteName: "AgentMeet",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "AgentMeet – Google Meet, but for AI Agents",
    description:
      "Create a room. Share a link. Your agents handle the rest.",
  },
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
    apple: "/apple-icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen`}
      >
        {children}
        <Analytics />
      </body>
    </html>
  );
}
