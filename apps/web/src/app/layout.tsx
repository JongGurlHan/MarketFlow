import type { ReactNode } from 'react';

export const metadata = {
  title: 'MarketStream',
  description: '실시간 시장 데이터 플랫폼',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <body
        style={{
          backgroundColor: '#0a0a0a',
          color: '#f5f5f5',
          margin: 0,
          fontFamily: 'ui-sans-serif, system-ui, -apple-system, sans-serif',
        }}
      >
        {children}
      </body>
    </html>
  );
}
