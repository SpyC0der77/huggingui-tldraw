import { setImage } from '@/lib/imageStore'
import { type GenerateParams, getProvider } from '@/lib/providers'

export const runtime = 'nodejs'

interface GenerateRequest {
	model: string
	prompt: string
	negativePrompt?: string
	steps?: number
	cfgScale?: number
	seed?: number
	controlNetMode?: string
	controlNetStrength?: number
	referenceImageUrl?: string
}

export async function POST(request: Request) {
	const body = (await request.json()) as GenerateRequest
	if (!body.prompt) {
		return Response.json({ error: 'prompt is required' }, { status: 400 })
	}

	const [providerName, modelId] = (body.model ?? 'flux:flux-dev').split(':')

	try {
		const provider = getProvider(providerName)
		const params: GenerateParams = {
			modelId: modelId ?? '',
			prompt: body.prompt,
			negativePrompt: body.negativePrompt,
			steps: body.steps ?? 20,
			cfgScale: body.cfgScale ?? 7,
			seed: body.seed ?? null,
			controlNetMode: body.controlNetMode,
			controlNetStrength: body.controlNetStrength,
			referenceImageUrl: body.referenceImageUrl,
		}

		let result = await provider.generate(params)

		if (result.imageUrl.startsWith('data:')) {
			const imageId = `gen_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
			const { bytes, contentType } = dataUrlToBytes(result.imageUrl)
			setImage(imageId, bytes, contentType)
			result = { ...result, imageUrl: `/api/images/${imageId}` }
		}

		return Response.json(result)
	} catch (error) {
		console.error('Generate error:', error)
		return Response.json(
			{ error: error instanceof Error ? error.message : 'Generation failed' },
			{ status: 500 }
		)
	}
}

function dataUrlToBytes(dataUrl: string): { bytes: Uint8Array; contentType: string } {
	const [header, payload = ''] = dataUrl.split(',', 2)
	const contentType = header.match(/^data:([^;]+)/)?.[1] ?? 'image/png'

	if (header.includes('base64')) {
		return {
			bytes: new Uint8Array(Buffer.from(payload, 'base64')),
			contentType,
		}
	}

	return {
		bytes: new TextEncoder().encode(decodeURIComponent(payload)),
		contentType,
	}
}

