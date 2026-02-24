'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import styles from './page.module.css'

export default function Home() {
	const [isAboutOpen, setIsAboutOpen] = useState(false)

	useEffect(() => {
		if (!isAboutOpen) return
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') setIsAboutOpen(false)
		}
		window.addEventListener('keydown', onKeyDown)
		return () => window.removeEventListener('keydown', onKeyDown)
	}, [isAboutOpen])

	return (
		<main className={styles.page}>
			<section className={styles.hero}>
				<p className={styles.eyebrow}>HuggingUI</p>
				<h1>The ComfyUI for HuggingFace</h1>
				<p className={styles.subtitle}>
					A node-based editor for Hugging Face inference providers and Spaces. Wire models, prompts,
					and image tools into repeatable workflows.
				</p>
				<div className={styles.heroActions}>
					<Link href="/editor" className={styles.primaryButton}>
						Open Editor
					</Link>
					<button type="button" className={styles.secondaryButton} onClick={() => setIsAboutOpen(true)}>
						About
					</button>
				</div>
			</section>
			{isAboutOpen ? (
				<div className={styles.modalBackdrop} onClick={() => setIsAboutOpen(false)}>
					<section
						className={styles.modal}
						role="dialog"
						aria-modal="true"
						aria-labelledby="about-title"
						onClick={(event) => event.stopPropagation()}
					>
						<h2 id="about-title">About HuggingUI</h2>
						<p>
							HuggingUI is a visual workflow editor for building AI pipelines on top of Hugging Face
							providers and Spaces.
						</p>
						<p>
							Use nodes for prompts, models, generation, and previews, then execute full graph regions or
							start from any node while keeping results visible on-canvas.
						</p>
						<div className={styles.modalActions}>
							<Link href="/editor" className={styles.primaryButton} onClick={() => setIsAboutOpen(false)}>
								Open Editor
							</Link>
							<button type="button" className={styles.secondaryButton} onClick={() => setIsAboutOpen(false)}>
								Close
							</button>
						</div>
					</section>
				</div>
			) : null}
		</main>
	)
}
