import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
	title: 'TLDraw Image Pipeline',
	description: 'Node-based image pipeline builder with TLDraw',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
