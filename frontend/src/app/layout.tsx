import type { Metadata } from 'next'
import { Space_Mono, Inter } from 'next/font/google'
import './globals.css'

const spaceMono = Space_Mono({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-mono',
})

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
})

export const metadata: Metadata = {
  title: 'HayhaiSearch - Neobrutalist Research Interface',
  description: 'Your AI search assistant',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`${spaceMono.variable} ${inter.variable}`}>
        {children}
      </body>
    </html>
  )
}
