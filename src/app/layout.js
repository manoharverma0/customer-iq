import { Inter } from 'next/font/google';
import './globals.css';
import Navbar from '@/components/Navbar';
import ChatWidget from '@/components/ChatWidget';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata = {
  title: 'CustomerIQ — AI Customer Intelligence System',
  description: 'Turn conversations into revenue. AI-powered chatbot with urgency detection, smart replies, and real-time business analytics.',
  keywords: 'AI, customer intelligence, chatbot, analytics, business, revenue',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <div className="bg-grid" />
        <div className="bg-orbs" />
        <Navbar />
        <main style={{ position: 'relative', zIndex: 1, paddingTop: 'var(--nav-height)' }}>
          {children}
        </main>
        <ChatWidget />
      </body>
    </html>
  );
}
