import './globals.css';
import Navbar from '@/components/Navbar';

export const metadata = {
  title: 'Bizz Assist — AI Business Assistant',
  description: 'Turn every conversation into a sale. AI-powered business assistant with urgency detection, semantic product search, and real-time analytics.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body style={{ display: 'flex', minHeight: '100vh' }}>
        <Navbar />
        <main style={{ flex: 1, minWidth: 0, overflow: 'auto' }}>
          {children}
        </main>
      </body>
    </html>
  );
}
