import type { Metadata, Viewport } from "next";
import { Figtree } from "next/font/google";
import { AppShell } from "@/components/app-shell";
import { ServiceWorkerRegistration } from "@/components/sw-registration";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const figtree = Figtree({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Panier",
  description: "Des recettes à la liste de courses, partagée en temps réel avec tes proches.",
  applicationName: "Panier",
  appleWebApp: {
    capable: true,
    title: "Panier",
    statusBarStyle: "default",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#faf8f5",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={`${figtree.variable} h-full antialiased`}>
      <body className="min-h-full">
        <AppShell>{children}</AppShell>
        <Toaster position="top-center" richColors={false} />
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
