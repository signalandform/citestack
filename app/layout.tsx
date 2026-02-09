import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Citestack",
  description: "Citation-first research library (save → summarize → search → cite)",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
