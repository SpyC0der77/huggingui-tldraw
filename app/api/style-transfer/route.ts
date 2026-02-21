import { resolveImage } from '@/lib/resolveImage'

export const runtime = 'nodejs'

interface StyleTransferRequest {
	styleImageUrl: string
	contentImageUrl?: string
	prompt?: string
	model: string
	strength: number
}

export async function POST(request: Request) {
	const body = (await request.json()) as StyleTransferRequest
	if (!body.styleImageUrl) {
		return Response.json({ error: 'styleImageUrl is required' }, { status: 400 })
	}

	const apiKey = process.env.REPLICATE_API_TOKEN
	if (!apiKey) {
		return Response.json(styleTransferPlaceholder(body))
	}

	try {
		const { dataUrl: styleDataUrl } = await resolveImage(body.styleImageUrl)
		const input: Record<string, unknown> = {
			style_image: styleDataUrl,
			prompt: body.prompt || '',
			style_strength: body.strength ?? 0.5,
		}

		if (body.contentImageUrl) {
			const { dataUrl: contentDataUrl } = await resolveImage(body.contentImageUrl)
			input.structure_image = contentDataUrl
		}

		const modelMap: Record<string, string> = {
			fast: 'fast',
			'high-quality': 'high-quality',
			realistic: 'realistic',
			cinematic: 'cinematic',
			animated: 'animated',
		}
		input.model = modelMap[body.model] ?? 'fast'

		const prediction = await fetch('https://api.replicate.com/v1/predictions', {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${apiKey}`,
				'Content-Type': 'application/json',
				Prefer: 'wait',
			},
			body: JSON.stringify({
				version: 'f1023890703bc0a5a3a2c21b5e498833be5f6ef6e70e9daf6b9b3a4fd8309cf0',
				input,
			}),
		})

		if (!prediction.ok) {
			const err = await prediction.text()
			throw new Error(`Replicate error: ${prediction.status} ${err}`)
		}

		const result = (await prediction.json()) as { output?: string[] | string }
		const outputUrl = Array.isArray(result.output) ? result.output[0] : result.output
		if (!outputUrl) {
			throw new Error('No output from style transfer')
		}

		return Response.json({ imageUrl: outputUrl })
	} catch (error) {
		console.error('Style transfer error:', error)
		return Response.json(
			{ error: error instanceof Error ? error.message : 'Style transfer failed' },
			{ status: 500 }
		)
	}
}

function styleTransferPlaceholder(params: StyleTransferRequest) {
	const hue = Math.floor(Math.random() * 360)
	const model = params.model || 'fast'
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024">
		<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
			<stop offset="0%" stop-color="hsl(${hue},55%,35%)"/>
			<stop offset="100%" stop-color="hsl(${(hue + 120) % 360},50%,50%)"/>
		</linearGradient></defs>
		<rect width="1024" height="1024" fill="url(#bg)"/>
		<text x="512" y="490" text-anchor="middle" fill="rgba(255,255,255,0.7)" font-family="sans-serif" font-size="22">Style Transfer</text>
		<text x="512" y="530" text-anchor="middle" fill="rgba(255,255,255,0.4)" font-family="sans-serif" font-size="14">${model} · strength ${params.strength} · placeholder</text>
	</svg>`
	return { imageUrl: `data:image/svg+xml,${encodeURIComponent(svg)}` }
}

