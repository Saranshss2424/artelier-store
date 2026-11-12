import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Artelier — Custom press-on nail studio",
  description: "Choose custom press-on nail designs and measure your fit before ordering.",
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
