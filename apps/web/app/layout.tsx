import type { Metadata } from "next";
import { Manrope, Libre_Baskerville } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const manrope = Manrope({ subsets: ["latin"], variable: "--font-sans" });
const baskerville = Libre_Baskerville({ subsets: ["latin"], weight: ["400", "700"], style: ["normal", "italic"], variable: "--font-serif" });

export const metadata: Metadata = {
  title: "G4 IA Assistente",
  description: "Assistente de IA do G4 para o seu negócio",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="dark">
      <body className={`${manrope.variable} ${baskerville.variable} font-sans antialiased`}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
