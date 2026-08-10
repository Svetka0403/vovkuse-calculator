import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Калькулятор подарочных корзин — ВоВкусе",
  description: "Предварительный расчёт подарочной корзины ВоВкусе",
  icons: { icon: "./favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
