import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "MediSafe — Your Personal Health Vault",
  description:
    "A privacy-focused AI-powered personal health vault. Upload medical documents, track your health data, and get AI-powered insights — all stored securely in your browser.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#1976D2" />
      </head>
      <body className={inter.className}>{children}</body>
    </html>
  );
}
