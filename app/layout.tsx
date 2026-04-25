import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Troopod — Ad Landing Page Personalizer",
  description:
    "Input your ad creative and landing page URL to get a CRO-optimized, personalized landing page in seconds.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body>{children}</body>
    </html>
  );
}
