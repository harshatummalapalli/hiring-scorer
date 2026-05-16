import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppHeader } from "@/components/app-header";
import { Providers } from "@/components/providers";
import { KARTA } from "@/lib/brand/karta";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: KARTA.name,
  description:
    "Karta analyses candidates against your job roles — beyond the resume.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-[#F8FAFC] font-sans text-[#334155]">
        <Providers>
          <AppHeader />
          <main className="flex-1">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
