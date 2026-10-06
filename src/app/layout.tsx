import type { Metadata } from "next";
import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/500.css";
import "@fontsource/dm-sans/600.css";
import "@fontsource/dm-sans/700.css";
import "@fontsource/manrope/400.css";
import "@fontsource/manrope/600.css";
import "@fontsource/manrope/700.css";
import "@fontsource/manrope/800.css";
import "./globals.css";
export const metadata: Metadata = {
    title: "MindSpine — Care, connected",
    description: "Your workspace for appointments, care records, and a healthier tomorrow.",
};
export default function RootLayout({ children, }: {
    children: React.ReactNode;
}) {
    return (<html lang="en">
      <body>{children}</body>
    </html>);
}
