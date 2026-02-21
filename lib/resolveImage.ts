import { getImage } from './imageStore'

export async function resolveImage(url: string): Promise<{ blob: Blob; dataUrl: string }> {
	if (url.startsWith('data:')) {
		const response = await fetch(url)
		if (!response.ok) {
			throw new Error('Invalid data URL')
		}
		const blob = await response.blob()
		return { blob, dataUrl: url }
	}

	if (url.startsWith('/api/images/')) {
		const imageId = url.slice('/api/images/'.length)
		const image = getImage(imageId)
		if (!image) {
			throw new Error(`Image not found: ${imageId}`)
		}
		return {
			blob: new Blob([image.bytes], { type: image.contentType }),
			dataUrl: toDataUrl(image.bytes, image.contentType),
		}
	}

	const response = await fetch(url)
	if (!response.ok) {
		throw new Error(`Failed to fetch image: ${response.status}`)
	}

	const contentType = response.headers.get('content-type') ?? 'image/png'
	const bytes = await response.arrayBuffer()
	return {
		blob: new Blob([bytes], { type: contentType }),
		dataUrl: toDataUrl(bytes, contentType),
	}
}

function toDataUrl(bytes: ArrayBuffer, contentType: string): string {
	return `data:${contentType};base64,${Buffer.from(bytes).toString('base64')}`
}
