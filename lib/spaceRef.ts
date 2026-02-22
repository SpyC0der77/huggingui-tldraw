const SPACE_REF_PREFIX = 'hf-space:'

export function encodeSpaceRef(spaceId: string): string {
	return `${SPACE_REF_PREFIX}${encodeURIComponent(spaceId.trim())}`
}

export function parseSpaceRef(value: string | null | undefined): string | null {
	if (typeof value !== 'string') return null
	const trimmed = value.trim()
	if (!trimmed) return null

	if (trimmed.startsWith(SPACE_REF_PREFIX)) {
		const encoded = trimmed.slice(SPACE_REF_PREFIX.length)
		return decodeURIComponent(encoded)
	}

	return trimmed
}
