import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Artelier — Art for your everyday",
  description: "Discover original art, thoughtful prints and handmade objects.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
