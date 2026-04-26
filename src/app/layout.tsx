import type { Metadata } from "next";
import "./globals.css";
import Providers from "./providers";

export const metadata: Metadata = {
  title: {
    default: "PlanMyWorkday",
    template: "%s | PlanMyWorkday",
  },
  description: "Keyboard-first task management with public content at the root and the workspace under /app.",
  icons: {
    icon: [
      { url: "/media/plan-my-workday/favicon.ico", sizes: "any" },
      { url: "/media/plan-my-workday/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/media/plan-my-workday/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: [{ url: "/media/plan-my-workday/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
