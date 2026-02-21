import { resolveImage } from '@/lib/resolveImage'

export const runtime = 'nodejs'

interface GenerateTextRequest {
	input?: string
	prompt: string
}

export async function POST(request: Request) {
	const body = (await request.json()) as GenerateTextRequest
	if (!body.prompt) {
		return Response.json({ error: 'prompt is required' }, { status: 400 })
	}

	const apiToken = process.env.REPLICATE_API_TOKEN
	if (!apiToken) {
		return Response.json(generateTextPlaceholder(body))
	}

	const inputStr = body.input != null ? String(body.input) : null
	const isImage =
		inputStr != null &&
		(inputStr.startsWith('data:image/') ||
			inputStr.startsWith('/api/images/') ||
			inputStr.startsWith('https://') ||
			inputStr.startsWith('http://'))

	try {
		let prompt = body.prompt
		if (inputStr && !isImage) {
			prompt = `Context:\n${inputStr}\n\n${body.prompt}`
		}

		const images: string[] = []
		if (inputStr && isImage) {
			const { dataUrl } = await resolveImage(inputStr)
			images.push(dataUrl)
		}

		const input: Record<string, unknown> = {
			prompt,
			max_output_tokens: 1024,
		}
		if (images.length > 0) {
			input.images = images
		}

		const response = await fetch(
			'https://api.replicate.com/v1/models/google/gemini-3-flash/predictions',
			{
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${apiToken}`,
					Prefer: 'wait',
				},
				body: JSON.stringify({ input }),
			}
		)

		if (!response.ok) {
			const err = await response.text()
			throw new Error(`Replicate error: ${response.status} ${err}`)
		}

		const result = (await response.json()) as { output?: string | string[] }
		const output = Array.isArray(result.output) ? result.output.join('') : result.output
		if (!output) {
			throw new Error('No output from text generation')
		}

		return Response.json({ text: output })
	} catch (error) {
		console.error('Generate text error:', error)
		return Response.json(
			{ error: error instanceof Error ? error.message : 'Text generation failed' },
			{ status: 500 }
		)
	}
}

function generateTextPlaceholder(body: GenerateTextRequest): { text: string } {
	const inputStr = body.input != null ? String(body.input) : null
	const isImage =
		inputStr != null &&
		(inputStr.startsWith('data:image/') ||
			inputStr.startsWith('/api/images/') ||
			inputStr.startsWith('https://') ||
			inputStr.startsWith('http://'))
	const inputDesc = inputStr
		? isImage
			? '[image provided]'
			: `[text: "${inputStr.slice(0, 40)}${inputStr.length > 40 ? '...' : ''}"]`
		: '[no input]'
	return {
		text: `[Placeholder] Prompt: "${body.prompt.slice(0, 60)}${body.prompt.length > 60 ? '...' : ''}" | Input: ${inputDesc} - Set REPLICATE_API_TOKEN for real text generation.`,
	}
}

