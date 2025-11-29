import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Chaski - Smart Courier Matching',
  description: 'Connect senders with couriers traveling along your route',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
