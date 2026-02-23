interface RunSpaceParams {
	spaceId: string
	apiName: string
	data: unknown[]
	accessToken?: string | null
}

interface SpaceMetadata {
	host?: string
}

interface ParsedSpaceStreamResult {
	output: unknown
	debug: {
		lineCount: number
		dataLineCount: number
		jsonDataLineCount: number
		messageSequence: string[]
		chosenEventReason:
			| 'process_completed.output.data'
			| 'process_completed.data'
			| 'latest_event.data'
			| 'latest_event.output.data'
			| 'latest_json'
			| 'raw_json'
			| 'raw_text'
			| 'empty_stream'
		latestEventKeys: string[]
		chosenEventKeys: string[]
	}
}

export interface SpaceOutputDebugSummary {
	topLevelType: string
	topLevelKeys: string[]
	stringCandidateCount: number
	stringCandidatesSample: string[]
	resolvedImageCandidateCount: number
	resolvedImageCandidatesSample: string[]
	fileLikeSample: Array<{
		path?: string
		url?: string
		mime_type?: string
	}>
}

export async function runHuggingFaceSpace({
	spaceId,
	apiName,
	data,
	accessToken,
}: RunSpaceParams): Promise<{
	output: unknown
	baseUrl: string
	debug?: ParsedSpaceStreamResult['debug']
}> {
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
	const parsed = parseSpaceEventStreamDetailed(streamText)
	return {
		output: parsed.output,
		baseUrl,
		debug: parsed.debug,
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

export function summarizeSpaceOutputForDebug(value: unknown, baseUrl: string): SpaceOutputDebugSummary {
	const stringCandidates: string[] = []
	collectStringCandidates(value, stringCandidates)
	const resolvedCandidates = stringCandidates
		.map((candidate) => resolveImageCandidate(candidate, baseUrl))
		.filter((entry): entry is string => Boolean(entry))
	const topLevelType = Array.isArray(value) ? 'array' : typeof value
	const topLevelKeys =
		value && typeof value === 'object' && !Array.isArray(value)
			? Object.keys(value as Record<string, unknown>).slice(0, 30)
			: []
	const fileLikeSample: Array<{ path?: string; url?: string; mime_type?: string }> = []
	collectFileLikeObjects(value, fileLikeSample, 12)

	return {
		topLevelType,
		topLevelKeys,
		stringCandidateCount: stringCandidates.length,
		stringCandidatesSample: stringCandidates.slice(0, 20),
		resolvedImageCandidateCount: resolvedCandidates.length,
		resolvedImageCandidatesSample: resolvedCandidates.slice(0, 20),
		fileLikeSample,
	}
}

function collectFileLikeObjects(
	value: unknown,
	out: Array<{ path?: string; url?: string; mime_type?: string }>,
	limit: number
) {
	if (out.length >= limit || value == null) return

	if (Array.isArray(value)) {
		for (const item of value) {
			if (out.length >= limit) break
			collectFileLikeObjects(item, out, limit)
		}
		return
	}

	if (typeof value !== 'object') return
	const obj = value as Record<string, unknown>
	const hasPath = typeof obj.path === 'string'
	const hasUrl = typeof obj.url === 'string'
	if (hasPath || hasUrl) {
		out.push({
			path: typeof obj.path === 'string' ? obj.path : undefined,
			url: typeof obj.url === 'string' ? obj.url : undefined,
			mime_type: typeof obj.mime_type === 'string' ? obj.mime_type : undefined,
		})
	}

	for (const nested of Object.values(obj)) {
		if (out.length >= limit) break
		collectFileLikeObjects(nested, out, limit)
	}
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

function parseSpaceEventStreamDetailed(streamText: string): ParsedSpaceStreamResult {
	const trimmed = streamText.trim()
	if (!trimmed) {
		return {
			output: null,
			debug: {
				lineCount: 0,
				dataLineCount: 0,
				jsonDataLineCount: 0,
				messageSequence: [],
				chosenEventReason: 'empty_stream',
				latestEventKeys: [],
				chosenEventKeys: [],
			},
		}
	}

	if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
		try {
			const output = JSON.parse(trimmed)
			const keys = getObjectKeys(output)
			return {
				output,
				debug: {
					lineCount: trimmed.split('\n').length,
					dataLineCount: 0,
					jsonDataLineCount: 0,
					messageSequence: [],
					chosenEventReason: 'raw_json',
					latestEventKeys: keys,
					chosenEventKeys: keys,
				},
			}
		} catch {
			return {
				output: trimmed,
				debug: {
					lineCount: trimmed.split('\n').length,
					dataLineCount: 0,
					jsonDataLineCount: 0,
					messageSequence: [],
					chosenEventReason: 'raw_text',
					latestEventKeys: [],
					chosenEventKeys: [],
				},
			}
		}
	}

	const allLines = trimmed.split('\n')
	let latestJson: unknown = null
	let latestEventObject: Record<string, unknown> | null = null
	const messageSequence: string[] = []
	let dataLineCount = 0
	let jsonDataLineCount = 0

	for (const line of allLines) {
		if (!line.startsWith('data:')) continue
		dataLineCount++
		const payload = line.slice(5).trim()
		if (!payload) continue
		try {
			latestJson = JSON.parse(payload)
			jsonDataLineCount++
			if (latestJson && typeof latestJson === 'object' && !Array.isArray(latestJson)) {
				latestEventObject = latestJson as Record<string, unknown>
				const msg = latestEventObject.msg
				if (typeof msg === 'string') {
					messageSequence.push(msg)
				}
			}
		} catch {
			latestJson = payload
		}
	}

	const allJsonEvents = extractAllJsonDataEvents(allLines)
	const completionEvent = [...allJsonEvents]
		.reverse()
		.find((event) => event.msg === 'process_completed')

	if (completionEvent) {
		const outputFromCompletion = extractPreferredEventData(completionEvent)
		return {
			output: outputFromCompletion,
			debug: {
				lineCount: allLines.length,
				dataLineCount,
				jsonDataLineCount,
				messageSequence: messageSequence.slice(-20),
				chosenEventReason:
					'output' in completionEvent
						? 'process_completed.output.data'
						: 'process_completed.data',
				latestEventKeys: latestEventObject ? Object.keys(latestEventObject).slice(0, 20) : [],
				chosenEventKeys: Object.keys(completionEvent).slice(0, 20),
			},
		}
	}

	if (latestEventObject) {
		const output = extractPreferredEventData(latestEventObject)
		return {
			output,
			debug: {
				lineCount: allLines.length,
				dataLineCount,
				jsonDataLineCount,
				messageSequence: messageSequence.slice(-20),
				chosenEventReason:
					'output' in latestEventObject ? 'latest_event.output.data' : 'latest_event.data',
				latestEventKeys: Object.keys(latestEventObject).slice(0, 20),
				chosenEventKeys: Object.keys(latestEventObject).slice(0, 20),
			},
		}
	}

	return {
		output: latestJson,
		debug: {
			lineCount: allLines.length,
			dataLineCount,
			jsonDataLineCount,
			messageSequence: messageSequence.slice(-20),
			chosenEventReason: 'latest_json',
			latestEventKeys: getObjectKeys(latestJson),
			chosenEventKeys: getObjectKeys(latestJson),
		},
	}
}

function extractAllJsonDataEvents(lines: string[]): Array<Record<string, unknown>> {
	const events: Array<Record<string, unknown>> = []
	for (const line of lines) {
		if (!line.startsWith('data:')) continue
		const payload = line.slice(5).trim()
		if (!payload) continue
		try {
			const parsed = JSON.parse(payload)
			if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
				events.push(parsed as Record<string, unknown>)
			}
		} catch {
			// ignore non-json lines
		}
	}
	return events
}

function extractPreferredEventData(event: Record<string, unknown>): unknown {
	if ('output' in event) {
		const output = event.output
		if (output && typeof output === 'object' && !Array.isArray(output)) {
			const outputObject = output as Record<string, unknown>
			if ('data' in outputObject) return outputObject.data
		}
		return output
	}

	if ('data' in event) {
		return event.data
	}

	return event
}

function getObjectKeys(value: unknown): string[] {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return []
	return Object.keys(value as Record<string, unknown>).slice(0, 20)
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
