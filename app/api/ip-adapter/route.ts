import { resolveImage } from '@/lib/resolveImage'

export const runtime = 'nodejs'

interface IPAdapterRequest {
	imageUrl: string
	prompt: string
	scale: number
	steps: number
}

export async function POST(request: Request) {
	const body = (await request.json()) as IPAdapterRequest
	if (!body.imageUrl) {
		return Response.json({ error: 'imageUrl is required' }, { status: 400 })
	}

	const apiKey = process.env.REPLICATE_API_TOKEN
	if (!apiKey) {
		return Response.json(ipAdapterPlaceholder(body))
	}

	try {
		const { dataUrl } = await resolveImage(body.imageUrl)
		const prediction = await fetch('https://api.replicate.com/v1/predictions', {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${apiKey}`,
				'Content-Type': 'application/json',
				Prefer: 'wait',
			},
			body: JSON.stringify({
				version: '904dc004af1dba5c9b13fc9e41635aeb2f9a177896a396ab3393f3f6493dbdd4',
				input: {
					image: dataUrl,
					prompt: body.prompt || 'best quality, high quality',
					scale: body.scale ?? 0.6,
					num_inference_steps: body.steps ?? 30,
				},
			}),
		})

		if (!prediction.ok) {
			const err = await prediction.text()
			throw new Error(`Replicate error: ${prediction.status} ${err}`)
		}

		const result = (await prediction.json()) as { output?: string[] | string }
		const outputUrl = Array.isArray(result.output) ? result.output[0] : result.output
		if (!outputUrl) {
			throw new Error('No output from IP-Adapter')
		}

		return Response.json({ imageUrl: outputUrl })
	} catch (error) {
		console.error('IP-Adapter error:', error)
		return Response.json(
			{ error: error instanceof Error ? error.message : 'IP-Adapter failed' },
			{ status: 500 }
		)
	}
}

function ipAdapterPlaceholder(params: IPAdapterRequest) {
	const hue = Math.floor(Math.random() * 360)
	const prompt = (params.prompt || 'IP-Adapter').slice(0, 30)
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024">
		<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
			<stop offset="0%" stop-color="hsl(${hue},50%,40%)"/>
			<stop offset="100%" stop-color="hsl(${(hue + 80) % 360},45%,55%)"/>
		</linearGradient></defs>
		<rect width="1024" height="1024" fill="url(#bg)"/>
		<text x="512" y="490" text-anchor="middle" fill="rgba(255,255,255,0.7)" font-family="sans-serif" font-size="22">${prompt}</text>
		<text x="512" y="530" text-anchor="middle" fill="rgba(255,255,255,0.4)" font-family="sans-serif" font-size="14">IP-Adapter · scale ${params.scale} · placeholder</text>
	</svg>`
	return { imageUrl: `data:image/svg+xml,${encodeURIComponent(svg)}` }
}

