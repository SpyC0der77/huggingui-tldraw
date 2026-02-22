interface RunSpaceParams {
	spaceId: string
	apiName: string
	data: unknown[]
	accessToken?: string | null
}

interface SpaceMetadata {
	host?: string
}

export async function runHuggingFaceSpace({
	spaceId,
	apiName,
	data,
	accessToken,
}: RunSpaceParams): Promise<{ output: unknown; baseUrl: string }> {
	const baseUrl = await resolveSpaceBaseUrl(spaceId, accessToken)
	const normalizedApiName = apiName.startsWith('/') ? apiName : `/${apiName}`
	const endpoint = `${baseUrl}/gradio_api/call${normalizedApiName}`
	const headers: Record<string, string> = {
		'Content-Type': 'application/json',
	}
	if (accessToken) {
		headers.Authorization = `Bearer ${accessToken}`
	}

	const startResponse = await fetch(endpoint, {
		method: 'POST',
		headers,
		body: JSON.stringify({ data }),
	})

	if (!startResponse.ok) {
		const text = await startResponse.text()
		throw new Error(`Space request failed (${startResponse.status}): ${text}`)
	}

	const startPayload = (await startResponse.json()) as { event_id?: string; data?: unknown }
	if (!startPayload.event_id) {
		return { output: startPayload.data, baseUrl }
	}

	const streamResponse = await fetch(`${endpoint}/${startPayload.event_id}`, {
		headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
	})

	if (!streamResponse.ok) {
		const text = await streamResponse.text()
		throw new Error(`Space stream failed (${streamResponse.status}): ${text}`)
	}

	const streamText = await streamResponse.text()
	return {
		output: parseSpaceEventStream(streamText),
		baseUrl,
	}
}

export function extractImageUrlFromSpaceOutput(value: unknown, baseUrl: string): string | null {
	const fromFileData = extractImageUrlFromFileData(value, baseUrl)
	if (fromFileData) return fromFileData

	const candidates: string[] = []
	collectStringCandidates(value, candidates)

	for (const candidate of candidates) {
		const resolved = resolveImageCandidate(candidate, baseUrl)
		if (resolved) return resolved
	}

	return null
}

function collectStringCandidates(value: unknown, out: string[]) {
	if (typeof value === 'string') {
		out.push(value)
		return
	}

	if (Array.isArray(value)) {
		for (const item of value) {
			collectStringCandidates(item, out)
		}
		return
	}

	if (!value || typeof value !== 'object') {
		return
	}

	const objectValue = value as Record<string, unknown>
	for (const [key, nested] of Object.entries(objectValue)) {
		if (key === 'url' || key === 'path' || key === 'image' || key === 'name') {
			collectStringCandidates(nested, out)
			continue
		}
		collectStringCandidates(nested, out)
	}
}

function extractImageUrlFromFileData(value: unknown, baseUrl: string): string | null {
	if (!value || typeof value !== 'object') return null

	if (Array.isArray(value)) {
		for (const entry of value) {
			const resolved = extractImageUrlFromFileData(entry, baseUrl)
			if (resolved) return resolved
		}
		return null
	}

	const obj = value as Record<string, unknown>
	const hasPath = typeof obj.path === 'string' && obj.path.length > 0
	const hasUrl = typeof obj.url === 'string' && obj.url.length > 0
	const mimeType = typeof obj.mime_type === 'string' ? obj.mime_type : null

	if (hasUrl) {
		const resolved = resolveImageCandidate(String(obj.url), baseUrl)
		if (resolved && (!mimeType || mimeType.startsWith('image/'))) {
			return resolved
		}
	}

	if (hasPath) {
		const pathValue = String(obj.path)
		const looksLikeImagePath =
			/\.(png|jpe?g|gif|webp|bmp|tiff?)$/i.test(pathValue) ||
			(mimeType ? mimeType.startsWith('image/') : true)
		if (looksLikeImagePath) {
			return buildGradioFileUrl(baseUrl, pathValue)
		}
	}

	for (const nested of Object.values(obj)) {
		const resolved = extractImageUrlFromFileData(nested, baseUrl)
		if (resolved) return resolved
	}

	return null
}

function resolveImageCandidate(candidate: string, baseUrl: string): string | null {
	const trimmed = candidate.trim()
	if (!trimmed) return null

	if (trimmed.startsWith('data:image/')) {
		return trimmed
	}
	if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
		return trimmed
	}
	if (trimmed.startsWith('/gradio_api/file=')) {
		return `${baseUrl}${trimmed}`
	}
	if (trimmed.startsWith('gradio_api/file=')) {
		return `${baseUrl}/${trimmed}`
	}
	if (trimmed.startsWith('/')) {
		// Treat local temp file paths as Gradio file handles.
		if (trimmed.startsWith('/tmp/') || trimmed.startsWith('/var/')) {
			return buildGradioFileUrl(baseUrl, trimmed)
		}
		return `${baseUrl}${trimmed}`
	}
	if (trimmed.startsWith('file=')) {
		return `${baseUrl}/gradio_api/${trimmed}`
	}

	return null
}

function buildGradioFileUrl(baseUrl: string, path: string): string {
	return `${baseUrl}/gradio_api/file=${encodeURIComponent(path)}`
}

function parseSpaceEventStream(streamText: string): unknown {
	const trimmed = streamText.trim()
	if (!trimmed) return null

	if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
		try {
			return JSON.parse(trimmed)
		} catch {
			return trimmed
		}
	}

	let latestJson: unknown = null
	for (const line of trimmed.split('\n')) {
		if (!line.startsWith('data:')) continue
		const payload = line.slice(5).trim()
		if (!payload) continue
		try {
			latestJson = JSON.parse(payload)
		} catch {
			latestJson = payload
		}
	}

	if (
		latestJson &&
		typeof latestJson === 'object' &&
		'data' in (latestJson as Record<string, unknown>)
	) {
		return (latestJson as Record<string, unknown>).data
	}

	return latestJson
}

export async function resolveSpaceBaseUrl(
	spaceId: string,
	accessToken?: string | null
): Promise<string> {
	const fallback = `https://${spaceId.replace(/\//g, '-')}.hf.space`
	try {
		const response = await fetch(`https://huggingface.co/api/spaces/${spaceId}`, {
			headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
		})

		if (!response.ok) {
			return fallback
		}

		const payload = (await response.json()) as SpaceMetadata
		if (!payload.host) {
			return fallback
		}

		return normalizeSpaceBaseUrl(payload.host, fallback)
	} catch {
		return fallback
	}
}

function normalizeSpaceBaseUrl(host: string, fallback: string): string {
	const value = host.trim()
	if (!value) return fallback

	if (value.startsWith('http://') || value.startsWith('https://')) {
		try {
			const url = new URL(value)
			return `${url.protocol}//${url.host}`
		} catch {
			return fallback
		}
	}

	return `https://${value}`
}
