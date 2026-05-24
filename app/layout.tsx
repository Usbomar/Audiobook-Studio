import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { AppShell } from "@/components/layout/app-shell";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "Audiobook Studio",
  description:
    "Estudi professional de gravació d'audiollibres al navegador",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ca" className={cn(geistSans.variable, geistMono.variable)}>
      <body className="min-h-screen font-sans antialiased">
        <TooltipProvider>
          <AppShell>{children}</AppShell>
        </TooltipProvider>
      </body>
    </html>
  );
}
