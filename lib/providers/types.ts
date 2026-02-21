export interface GenerateParams {
	modelId: string
	prompt: string
	negativePrompt?: string
	steps: number
	cfgScale: number
	seed: number | null
	controlNetMode?: string
	controlNetStrength?: number
	referenceImageUrl?: string
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

export interface ImageProvider {
	name: string
	generate(params: GenerateParams): Promise<GenerateResult>
	upscale?(params: UpscaleParams): Promise<UpscaleResult>
}

