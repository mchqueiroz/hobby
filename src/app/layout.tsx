import type { Metadata, Viewport } from "next";
import "@fontsource/lora/400.css";
import "@fontsource/lora/700.css";
import "@fontsource/lora/700-italic.css";
import "@fontsource-variable/inter";
import "./globals.css";
import { THEME_BOOT } from "@/lib/theme";
import { Shell } from "@/components/Shell";

export const metadata: Metadata = {
  title: "Hobby",
  description: "Todos os seus hobbies em um perfil. A próxima descoberta vem de qualquer mídia.",
  appleWebApp: { capable: true, title: "Hobby", statusBarStyle: "default" },
  icons: { apple: "/icon-192.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4efe6" },
    { media: "(prefers-color-scheme: dark)", color: "#15140f" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      </head>
      <body>
        <a className="skip" href="#conteudo">Ir para o conteúdo</a>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
