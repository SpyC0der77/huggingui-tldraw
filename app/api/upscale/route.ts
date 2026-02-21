import { type UpscaleParams, getUpscaleProvider } from '@/lib/providers'

export const runtime = 'nodejs'

interface UpscaleRequest {
	imageUrl: string
	scale: number
	method: string
}

export async function POST(request: Request) {
	const body = (await request.json()) as UpscaleRequest
	if (!body.imageUrl) {
		return Response.json({ error: 'imageUrl is required' }, { status: 400 })
	}

	try {
		const provider = getUpscaleProvider(body.method)
		const params: UpscaleParams = {
			imageUrl: body.imageUrl,
			scale: body.scale,
			method: body.method,
		}

		if (!provider.upscale) {
			return Response.json(
				{ error: `Provider "${provider.name}" does not support upscaling` },
				{ status: 400 }
			)
		}

		const result = await provider.upscale(params)
		return Response.json(result)
	} catch (error) {
		console.error('Upscale error:', error)
		return Response.json(
			{ error: error instanceof Error ? error.message : 'Upscale failed' },
			{ status: 500 }
		)
	}
}

