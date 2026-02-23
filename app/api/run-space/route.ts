import { getOptionalHuggingFaceAccessToken } from '@/lib/auth/huggingfaceToken'
import {
	extractImageUrlFromSpaceOutput,
	runHuggingFaceSpace,
	summarizeSpaceOutputForDebug,
} from '@/lib/huggingfaceSpaces'

interface RunSpaceRequest {
	spaceId: string
	apiName: string
	args: unknown[]
}

export async function POST(request: Request) {
	const body = (await request.json()) as RunSpaceRequest
	const requestId = `run_space_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
	const spaceId = body.spaceId?.trim()
	const apiName = body.apiName?.trim()
	if (!spaceId) {
		console.error('[run-space] missing spaceId', { requestId, bodyKeys: Object.keys(body ?? {}) })
		return Response.json({ error: 'spaceId is required' }, { status: 400 })
	}
	if (!apiName) {
		console.error('[run-space] missing apiName', { requestId, spaceId, bodyKeys: Object.keys(body ?? {}) })
		return Response.json({ error: 'apiName is required' }, { status: 400 })
	}

	try {
		const token = getOptionalHuggingFaceAccessToken(request)
		const args = Array.isArray(body.args) ? body.args : []
		const argPreview = args.map((arg) => {
			if (typeof arg === 'string') return arg.slice(0, 120)
			try {
				return JSON.stringify(arg).slice(0, 120)
			} catch {
				return String(arg)
			}
		})
		console.info('[run-space] start', {
			requestId,
			spaceId,
			apiName,
			authMode: token ? 'token_present' : 'no_token',
			argCount: args.length,
			argTypes: args.map((arg) => (Array.isArray(arg) ? 'array' : typeof arg)),
			argPreview,
		})
		const result = await runHuggingFaceSpace({
			spaceId,
			apiName,
			data: args,
			accessToken: token,
		})
		const imageUrl = extractImageUrlFromSpaceOutput(result.output, result.baseUrl)
		const outputDebug = summarizeSpaceOutputForDebug(result.output, result.baseUrl)
		console.info('[run-space] success', {
			requestId,
			spaceId,
			apiName,
			baseUrl: result.baseUrl,
			hasImageUrl: Boolean(imageUrl),
			outputType: Array.isArray(result.output) ? 'array' : typeof result.output,
			outputTopLevelKeys: outputDebug.topLevelKeys,
			outputPreview: imageUrl
				? undefined
				: JSON.stringify(result.output, null, 2).slice(0, 2400),
		})
		if (!imageUrl) {
			console.warn('[run-space] no image extracted', {
				requestId,
				spaceId,
				apiName,
				debug: outputDebug,
			})
		}
		if (result.debug) {
			console.info('[run-space] stream parse debug', {
				requestId,
				spaceId,
				apiName,
				...result.debug,
			})
		}

		return Response.json({
			requestId,
			spaceId,
			apiName,
			baseUrl: result.baseUrl,
			output: result.output,
			imageUrl,
		})
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Failed to run Space'
		console.error('[run-space] failed', {
			requestId,
			spaceId,
			apiName,
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
