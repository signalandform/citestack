import type { Metadata } from "next";
import "./globals.css";
import { ToastProvider } from "@/app/contexts/toast";
import { ThemeProvider } from "@/app/contexts/theme";
import { Footer } from "@/app/components/Footer";

export const metadata: Metadata = {
  title: "Citestack",
  description: "Citation-first research library (save → summarize → search → cite)",
  icons: { icon: "/favicon.png" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <ToastProvider>
          <ThemeProvider>
          {children}
          <Footer />
        </ThemeProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
