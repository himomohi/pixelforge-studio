import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PixelForge Studio",
  description:
    "A professional browser pixel-art editor for drawing, frame animation, palettes, sprite sheets, GIF export, and WebMCP automation.",
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
    <html lang="en" className="dark">
      <body className="antialiased">{children}</body>
    </html>
  );
}
