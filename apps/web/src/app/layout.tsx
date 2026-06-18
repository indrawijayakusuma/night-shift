import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Night-Shift Handover',
  description: 'Generate morning handovers from structured events and relief night logs',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>): React.ReactElement {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
            <div>
              <h1 className="text-lg font-semibold text-slate-900">Night-Shift Handover</h1>
              <p className="text-sm text-slate-500">Lumen Boutique Hotel — demo</p>
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
      </body>
    </html>
  )
}
