import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
	title: 'HuggingUI',
	description:
		'ComfyUI-style node workflows powered by Hugging Face Inference Providers and Spaces.',
}

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode
}>) {
	return (
		<html lang="en">
			<body>{children}</body>
		</html>
	)
}
