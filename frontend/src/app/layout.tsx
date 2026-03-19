import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cache Me If You Can",
  description: "Master the market. Build wealth. Beat your friends.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
