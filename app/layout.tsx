import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import NavigationLoading from "@/components/navigation-loading";
import "./globals.css";

export const metadata: Metadata = {
  title: "SunGrid",
  description: "Event-Driven Multi-Tenant Agile Workspace Platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body>
          {children}
          <NavigationLoading />
        </body>
      </html>
    </ClerkProvider>
  );
}