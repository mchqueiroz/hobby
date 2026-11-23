import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Hobby",
    short_name: "Hobby",
    description: "Todos os seus hobbies em um perfil. A próxima descoberta vem de qualquer mídia.",
    start_url: "/inicio",
    display: "standalone",
    background_color: "#f4f4f1",
    theme_color: "#f4f4f1",
    lang: "pt-BR",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
