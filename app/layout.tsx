import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Калькулятор подарочных корзин — ВоВкусе",
  description: "Предварительный расчёт подарочной корзины ВоВкусе",
  robots: { index: false, follow: false },
  icons: { icon: "./favicon.svg" },
};

const embedModeScript = `
  try {
    if (window.self !== window.top) {
      document.documentElement.classList.add("embedded");
    }
  } catch {
    document.documentElement.classList.add("embedded");
  }
`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <head>
        <script dangerouslySetInnerHTML={{ __html: embedModeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
