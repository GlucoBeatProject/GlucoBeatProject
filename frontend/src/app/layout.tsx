import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'GlucoBeat',
  description: 'Smart User-Guided Automated Regulation!',
  icons: {
    icon: '/real_logo.png',
    shortcut: '/apple_icon.png',
    apple: '/apple_icon.png',
    other: {
      rel: 'apple-touch-icon-precomposed',
      url: '/apple_icon.png',
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="apple-mobile-web-app-title" content="GlucoBeat" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="theme-color" content="#FFE1E1" />
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body>
        <div className="min-h-dvh">{children}</div>
      </body>
    </html>
  );
}
