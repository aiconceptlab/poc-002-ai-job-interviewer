import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'AI Job Interviewer | AI Concept Lab',
  description: 'A little practice. A clearer answer. Voice interview practice with a transparent scoring rubric and feedback grounded in your words.',
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
