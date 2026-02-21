import { getImage, hasImage, setImage } from '@/lib/imageStore'

export const runtime = 'nodejs'

export async function POST(
	request: Request,
	context: { params: Promise<{ imageId: string }> }
) {
	const { imageId } = await context.params
	const contentType = request.headers.get('content-type') ?? 'image/png'

	if (!contentType.startsWith('image/')) {
		return Response.json({ error: 'Invalid content type' }, { status: 400 })
	}

	if (hasImage(imageId)) {
		return Response.json({ ok: true })
	}

	const body = await request.arrayBuffer()
	setImage(imageId, body, contentType)
	return Response.json({ ok: true })
}

export async function GET(
	_request: Request,
	context: { params: Promise<{ imageId: string }> }
) {
	const { imageId } = await context.params
	const image = getImage(imageId)
	if (!image) {
		return new Response('Not found', { status: 404 })
	}

	return new Response(image.bytes, {
		headers: {
			'content-type': image.contentType,
			'cache-control': 'public, max-age=31536000, immutable',
		},
	})
}

