import { Outfit } from 'next/font/google';
import './globals.css';

const outfit = Outfit({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-outfit',
  display: 'swap',
});

export const metadata = {
  title: 'Multi-Stream Chat Overlay',
  description: 'Sistem overlay chat terpadu untuk Twitch, YouTube, dan TikTok',
};

export default function RootLayout({ children }) {
  return (
    <html lang="id" className={outfit.variable}>
      <body>
        {children}
      </body>
    </html>
  );
}
