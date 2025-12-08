import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Chaski - Smart Courier Matching',
  description: 'Connect senders with couriers traveling along your route',
};

// Root layout that passes children to locale-specific layout
// The [locale]/layout.tsx provides the actual <html> and <body> tags
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
