interface RunSpaceParams {
	spaceId: string
	apiName: string
	data: unknown[]
	accessToken: string
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
		Authorization: `Bearer ${accessToken}`,
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
		headers: {
			Authorization: `Bearer ${accessToken}`,
		},
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
	const candidates: string[] = []
	collectStringCandidates(value, candidates)

	for (const candidate of candidates) {
		if (candidate.startsWith('data:image/')) {
			return candidate
		}
		if (candidate.startsWith('http://') || candidate.startsWith('https://')) {
			return candidate
		}
		if (candidate.startsWith('/')) {
			return `${baseUrl}${candidate}`
		}
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

async function resolveSpaceBaseUrl(spaceId: string, accessToken: string): Promise<string> {
	const fallback = `https://${spaceId.replace(/\//g, '-')}.hf.space`
	try {
		const response = await fetch(`https://huggingface.co/api/spaces/${spaceId}`, {
			headers: {
				Authorization: `Bearer ${accessToken}`,
			},
		})

		if (!response.ok) {
			return fallback
		}

		const payload = (await response.json()) as SpaceMetadata
		if (!payload.host) {
			return fallback
		}

		return `https://${payload.host}`
	} catch {
		return fallback
	}
}
