import {
	DEFAULT_HF_MODEL_ID,
	DEFAULT_HF_PROVIDER,
	DEFAULT_SPACE_ARGS_TEMPLATE,
} from '../modelRef'
import { resolveImage } from '../resolveImage'
import { extractImageUrlFromSpaceOutput, runHuggingFaceSpace } from '../huggingfaceSpaces'
import type {
	GenerateParams,
	GenerateResult,
	ImageProvider,
	ProviderContext,
	UpscaleParams,
	UpscaleResult,
} from './types'

const IMAGE_RESPONSE_TYPES = ['image/', 'application/octet-stream']
const IMAGE_ACCEPT_HEADER = 'image/png'

const UPSCALE_MODEL_BY_METHOD: Record<string, string> = {
	bilinear: 'caidas/swin2SR-classical-sr-x2-64',
	lanczos: 'caidas/swin2SR-classical-sr-x2-64',
	ai_enhanced: 'caidas/swin2SR-realworld-sr-x4-64-bsrgan-psnr',
	swin2sr_x2: 'caidas/swin2SR-classical-sr-x2-64',
	swin2sr_x4: 'caidas/swin2SR-realworld-sr-x4-64-bsrgan-psnr',
}

export const huggingface: ImageProvider = {
	name: 'huggingface',

	async generate(params: GenerateParams, context: ProviderContext): Promise<GenerateResult> {
		if (params.spaceId) {
			return generateWithSpace(params, context)
		}

		if (params.referenceImageUrl) {
			return generateWithImageToImage(params, context)
		}

		return generateWithTextToImage(params, context)
	},

	async upscale(params: UpscaleParams, context: ProviderContext): Promise<UpscaleResult> {
		const modelId = resolveUpscaleModelId(params)
		const inputImage = await resolveImage(params.imageUrl)
		const endpoint = buildRouterModelUrl('hf-inference', modelId, 'image-to-image')
		const formData = new FormData()
		formData.set('inputs', inputImage.blob, 'source.png')

		const response = await fetch(endpoint, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${context.accessToken}`,
				Accept: IMAGE_ACCEPT_HEADER,
				'x-wait-for-model': 'true',
			},
			body: formData,
		})

		return {
			imageUrl: await parseImageResponse(response, `Upscale failed for model "${modelId}"`),
		}
	},
}

async function generateWithTextToImage(
	params: GenerateParams,
	context: ProviderContext
): Promise<GenerateResult> {
	const provider = params.provider || DEFAULT_HF_PROVIDER
	const modelId = params.modelId || DEFAULT_HF_MODEL_ID
	const endpoint = buildRouterModelUrl(provider, modelId, 'text-to-image')
	const requestBody: Record<string, unknown> = {
		inputs: params.prompt,
	}

	const parameters: Record<string, unknown> = {}
	if (params.negativePrompt) parameters.negative_prompt = params.negativePrompt
	if (params.steps) parameters.num_inference_steps = params.steps
	if (params.cfgScale) parameters.guidance_scale = params.cfgScale
	if (params.seed != null) parameters.seed = params.seed
	if (Object.keys(parameters).length > 0) {
		requestBody.parameters = parameters
	}

	const response = await fetch(endpoint, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${context.accessToken}`,
			'Content-Type': 'application/json',
			Accept: IMAGE_ACCEPT_HEADER,
			'x-wait-for-model': 'true',
		},
		body: JSON.stringify(requestBody),
	})

	return {
		imageUrl: await parseImageResponse(response, `Generation failed for model "${modelId}"`),
		seed: params.seed ?? 0,
	}
}

async function generateWithImageToImage(
	params: GenerateParams,
	context: ProviderContext
): Promise<GenerateResult> {
	const provider = params.provider || DEFAULT_HF_PROVIDER
	const modelId = params.modelId || DEFAULT_HF_MODEL_ID
	const endpoint = buildRouterModelUrl(provider, modelId, 'image-to-image')
	const referenceImage = await resolveImage(params.referenceImageUrl ?? '')
	const formData = new FormData()
	formData.set('inputs', referenceImage.blob, 'reference.png')

	const parameters: Record<string, unknown> = {
		prompt: params.prompt,
	}
	if (params.negativePrompt) parameters.negative_prompt = params.negativePrompt
	if (params.steps) parameters.num_inference_steps = params.steps
	if (params.cfgScale) parameters.guidance_scale = params.cfgScale
	if (params.seed != null) parameters.seed = params.seed
	if (params.controlNetStrength != null) {
		parameters.strength = Math.max(0, Math.min(1, params.controlNetStrength / 100))
	}

	formData.set('parameters', JSON.stringify(parameters))

	const response = await fetch(endpoint, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${context.accessToken}`,
			Accept: IMAGE_ACCEPT_HEADER,
			'x-wait-for-model': 'true',
		},
		body: formData,
	})

	return {
		imageUrl: await parseImageResponse(response, `Image-to-image failed for model "${modelId}"`),
		seed: params.seed ?? 0,
	}
}

async function generateWithSpace(
	params: GenerateParams,
	context: ProviderContext
): Promise<GenerateResult> {
	if (!params.spaceId?.trim()) {
		throw new Error('Space provider selected but no Space ID was configured in the model node')
	}

	const resolvedImage = params.referenceImageUrl
		? await resolveImage(params.referenceImageUrl)
		: null
	const interpolationValues: Record<string, unknown> = {
		prompt: params.prompt,
		negativePrompt: params.negativePrompt ?? '',
		steps: params.steps,
		cfgScale: params.cfgScale,
		seed: params.seed ?? 0,
		referenceImageUrl: params.referenceImageUrl ?? null,
		referenceImageDataUrl: resolvedImage?.dataUrl ?? null,
		controlNetMode: params.controlNetMode ?? '',
		controlNetStrength: params.controlNetStrength ?? 0,
	}

	const data = buildSpaceData(params.spaceArgsTemplate ?? DEFAULT_SPACE_ARGS_TEMPLATE, interpolationValues)
	const spaceResponse = await runHuggingFaceSpace({
		spaceId: params.spaceId ?? '',
		apiName: params.spaceApiName ?? '/predict',
		data,
		accessToken: context.accessToken,
	})
	const imageUrl = extractImageUrlFromSpaceOutput(spaceResponse.output, spaceResponse.baseUrl)
	if (!imageUrl) {
		throw new Error('Space call succeeded but no image URL was found in the response payload')
	}

	return { imageUrl, seed: params.seed ?? 0 }
}

function buildRouterModelUrl(
	provider: string,
	modelId: string,
	task: 'text-to-image' | 'image-to-image'
): string {
	const routeProvider = resolveRouterProvider(provider)
	const routedModelId = applyRoutingPolicyToModelId(provider, modelId)
	void task
	const path = `models/${routedModelId}`
	return `https://router.huggingface.co/${routeProvider}/${path}`
}

function resolveRouterProvider(provider: string): string {
	if (!provider || provider === 'auto' || provider === 'fastest' || provider === 'cheapest') {
		return 'hf-inference'
	}
	return provider
}

function applyRoutingPolicyToModelId(provider: string, modelId: string): string {
	const normalizedModelId = modelId.trim()
	if (!normalizedModelId) return normalizedModelId
	if (normalizedModelId.includes(':')) return normalizedModelId

	if (provider === 'fastest' || provider === 'auto') {
		return `${normalizedModelId}:fastest`
	}
	if (provider === 'cheapest') {
		return `${normalizedModelId}:cheapest`
	}

	return normalizedModelId
}

function resolveUpscaleModelId(params: UpscaleParams): string {
	if (params.scale >= 4) {
		return 'caidas/swin2SR-realworld-sr-x4-64-bsrgan-psnr'
	}

	return UPSCALE_MODEL_BY_METHOD[params.method] ?? 'caidas/swin2SR-classical-sr-x2-64'
}

async function parseImageResponse(response: Response, contextMessage: string): Promise<string> {
	if (!response.ok) {
		const text = await response.text()
		throw new Error(`${contextMessage} (${response.status}): ${text}`)
	}

	const contentType = response.headers.get('content-type') ?? 'application/octet-stream'
	if (!IMAGE_RESPONSE_TYPES.some((type) => contentType.includes(type))) {
		const text = await response.text()
		try {
			const payload = JSON.parse(text) as unknown
			const imageUrl = extractImageUrlFromSpaceOutput(payload, '')
			if (imageUrl) {
				return imageUrl
			}
		} catch {
			// Fall through to error below.
		}
		throw new Error(`${contextMessage}: unexpected content type "${contentType}" with body ${text}`)
	}

	const bytes = await response.arrayBuffer()
	return `data:${contentType};base64,${Buffer.from(bytes).toString('base64')}`
}

function buildSpaceData(
	template: string,
	values: Record<string, unknown>
): unknown[] {
	let parsedTemplate: unknown
	try {
		parsedTemplate = JSON.parse(template)
	} catch {
		parsedTemplate = JSON.parse(DEFAULT_SPACE_ARGS_TEMPLATE)
	}

	const hydrated = interpolateTemplate(parsedTemplate, values)
	return Array.isArray(hydrated) ? hydrated : [hydrated]
}

function interpolateTemplate(template: unknown, values: Record<string, unknown>): unknown {
	if (typeof template === 'string') {
		const exactMatch = template.match(/^\{([a-zA-Z0-9_]+)\}$/)
		if (exactMatch) {
			return values[exactMatch[1]] ?? null
		}

		return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_match, tokenName: string) => {
			const replacement = values[tokenName]
			return replacement == null ? '' : String(replacement)
		})
	}

	if (Array.isArray(template)) {
		return template.map((item) => interpolateTemplate(item, values))
	}

	if (!template || typeof template !== 'object') {
		return template
	}

	const output: Record<string, unknown> = {}
	for (const [key, nestedValue] of Object.entries(template)) {
		output[key] = interpolateTemplate(nestedValue, values)
	}
	return output
}
