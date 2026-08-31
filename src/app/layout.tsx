import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
  title: {
    template: "%s | SIMBA",
    default: "SIMBA - Sistem Absensi SMP Sukma Bangsa Pidie",
  },
  description: "Sistem Absensi Terintegrasi IoT RFID untuk SMP Sukma Bangsa Pidie. Memudahkan pemantauan kehadiran, pengajuan izin, dan laporan absensi siswa secara real-time.",
  keywords: ["SIMBA", "Absensi", "RFID", "SMP Sukma Bangsa Pidie", "Sistem Absensi", "IoT"],
  authors: [{ name: "SMP Sukma Bangsa Pidie" }],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="id"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
