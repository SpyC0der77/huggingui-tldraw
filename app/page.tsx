import Link from 'next/link'

export default function Home() {
	return (
		<main
			style={{
				minHeight: '100vh',
				display: 'grid',
				placeItems: 'center',
				padding: '40px 20px',
				background:
					'radial-gradient(circle at 15% 20%, rgba(82, 129, 255, 0.16), transparent 35%), radial-gradient(circle at 80% 10%, rgba(40, 199, 111, 0.12), transparent 30%), #f7f8fb',
			}}
		>
			<section
				style={{
					width: 'min(900px, 100%)',
					border: '1px solid rgba(20, 24, 35, 0.1)',
					borderRadius: 20,
					background: 'rgba(255,255,255,0.85)',
					backdropFilter: 'blur(8px)',
					boxShadow: '0 20px 60px rgba(12, 15, 24, 0.14)',
					padding: '42px 34px',
				}}
			>
				<p
					style={{
						margin: 0,
						fontSize: 12,
						fontWeight: 700,
						letterSpacing: '0.08em',
						textTransform: 'uppercase',
						color: '#4b5565',
					}}
				>
					HuggingUI
				</p>
				<h1
					style={{
						margin: '10px 0 14px 0',
						fontSize: 'clamp(28px, 4vw, 52px)',
						lineHeight: 1.05,
					}}
				>
					Visual AI workflows for Hugging Face models and Spaces
				</h1>
				<p
					style={{
						margin: 0,
						maxWidth: 700,
						color: '#5b6473',
						fontSize: 16,
						lineHeight: 1.6,
					}}
				>
					Build pipelines on a node canvas, connect providers or Spaces, and run generation end-to-end
					from one editor.
				</p>
				<div style={{ marginTop: 28, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
					<Link
						href="/editor"
						style={{
							display: 'inline-flex',
							alignItems: 'center',
							justifyContent: 'center',
							height: 42,
							padding: '0 18px',
							borderRadius: 10,
							background: '#111827',
							color: 'white',
							textDecoration: 'none',
							fontSize: 14,
							fontWeight: 600,
						}}
					>
						Open Editor
					</Link>
					<a
						href="https://huggingface.co"
						target="_blank"
						rel="noreferrer"
						style={{
							display: 'inline-flex',
							alignItems: 'center',
							justifyContent: 'center',
							height: 42,
							padding: '0 18px',
							borderRadius: 10,
							border: '1px solid #d2d7e0',
							color: '#1f2937',
							textDecoration: 'none',
							fontSize: 14,
							fontWeight: 600,
							background: 'white',
						}}
					>
						Hugging Face
					</a>
				</div>
			</section>
		</main>
	)
}
