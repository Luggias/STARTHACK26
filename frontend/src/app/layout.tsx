import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cache Me If You Can",
  description:
    "Learn financial markets through play. Build portfolios, test strategies, and compete with friends.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
