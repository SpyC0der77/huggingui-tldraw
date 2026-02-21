type StoredImage = {
	bytes: ArrayBuffer
	contentType: string
}

declare global {
	// eslint-disable-next-line no-var
	var __hugginguiImageStore: Map<string, StoredImage> | undefined
}

const imageStore = globalThis.__hugginguiImageStore ?? new Map<string, StoredImage>()
if (!globalThis.__hugginguiImageStore) {
	globalThis.__hugginguiImageStore = imageStore
}

export function setImage(imageId: string, bytes: ArrayBuffer | Uint8Array, contentType: string) {
	const storedBytes = bytes instanceof Uint8Array ? Uint8Array.from(bytes).buffer : bytes.slice(0)
	imageStore.set(imageId, { bytes: storedBytes, contentType })
}

export function getImage(imageId: string): StoredImage | undefined {
	return imageStore.get(imageId)
}

export function hasImage(imageId: string): boolean {
	return imageStore.has(imageId)
}
