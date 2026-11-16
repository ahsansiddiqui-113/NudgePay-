import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'NudgePay: automatic polite invoice reminders',
  description: 'Set it once. NudgePay follows up politely until you get paid.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
