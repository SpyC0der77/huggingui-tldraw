import { getOptionalHuggingFaceAccessToken } from '@/lib/auth/huggingfaceToken'
import { resolveSpaceBaseUrl } from '@/lib/huggingfaceSpaces'

interface SpaceInfoRequest {
	spaceId: string
}

interface SpaceInfoResponse {
	named_endpoints?: Record<string, unknown>
}

export async function POST(request: Request) {
	const body = (await request.json()) as SpaceInfoRequest
	const spaceId = body.spaceId?.trim()
	const requestId = `space_info_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
	if (!spaceId) {
		console.error('[space-info] missing spaceId', { requestId, bodyKeys: Object.keys(body ?? {}) })
		return Response.json({ error: 'spaceId is required' }, { status: 400 })
	}

	try {
		const token = getOptionalHuggingFaceAccessToken(request)
		console.info('[space-info] start', {
			requestId,
			spaceId,
			authMode: token ? 'token_present' : 'no_token',
		})
		const baseUrl = await resolveSpaceBaseUrl(spaceId, token)
		const infoUrl = `${baseUrl}/gradio_api/info`
		console.info('[space-info] resolved base url', { requestId, spaceId, baseUrl, infoUrl })
		const infoResponse = await fetch(`${baseUrl}/gradio_api/info`, {
			headers: token ? { Authorization: `Bearer ${token}` } : undefined,
		})
		console.info('[space-info] upstream response', {
			requestId,
			spaceId,
			status: infoResponse.status,
			ok: infoResponse.ok,
			contentType: infoResponse.headers.get('content-type'),
		})

		if (!infoResponse.ok) {
			const text = await infoResponse.text()
			console.error('[space-info] upstream non-200', {
				requestId,
				spaceId,
				status: infoResponse.status,
				bodyPreview: text.slice(0, 1200),
			})
			throw new Error(`Space info request failed (${infoResponse.status}): ${text}`)
		}

		const info = (await infoResponse.json()) as SpaceInfoResponse
		const namedEndpoints = info.named_endpoints ?? {}
		const endpoints = Object.entries(namedEndpoints)
			.filter(([, value]) => {
				if (!value || typeof value !== 'object') return false
				const showApi = (value as Record<string, unknown>).show_api
				return showApi === undefined || showApi === true
			})
			.map(([apiName, value]) => ({
				apiName,
				...(value as Record<string, unknown>),
			}))
		console.info('[space-info] parsed endpoints', {
			requestId,
			spaceId,
			endpointCount: endpoints.length,
			endpointNames: endpoints.map((e) => e.apiName).slice(0, 20),
		})

		return Response.json({
			spaceId,
			baseUrl,
			endpoints,
		})
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Failed to fetch Space info'
		console.error('[space-info] failed', {
			requestId,
			spaceId,
			errorName: error instanceof Error ? error.name : typeof error,
			errorMessage: message,
			errorStack: error instanceof Error ? error.stack : undefined,
		})
		return Response.json(
			{ error: message, requestId },
			{ status: 500 }
		)
	}
}
