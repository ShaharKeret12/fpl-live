import "@/styles/globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "FPL — Rice vs Sarr (Live)",
  description: "Head-to-head live points tracker",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
