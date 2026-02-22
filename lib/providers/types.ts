export interface GenerateParams {
	provider: string
	modelId: string
	prompt: string
	negativePrompt?: string
	steps: number
	cfgScale: number
	seed: number | null
	controlNetMode?: string
	controlNetStrength?: number
	referenceImageUrl?: string
	spaceId?: string
	spaceApiName?: string
	spaceArgsTemplate?: string
}

export interface GenerateResult {
	imageUrl: string
	seed: number
}

export interface UpscaleParams {
	imageUrl: string
	scale: number
	method: string
}

export interface UpscaleResult {
	imageUrl: string
}

export interface ProviderContext {
	accessToken: string
}

export interface ImageProvider {
	name: string
	generate(params: GenerateParams, context: ProviderContext): Promise<GenerateResult>
	upscale?(params: UpscaleParams, context: ProviderContext): Promise<UpscaleResult>
}
