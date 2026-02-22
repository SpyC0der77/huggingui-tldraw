import { useState } from 'react'
import { createShapeId, Editor, TLComponents, Tldraw, TldrawOptions } from 'tldraw'
import { HuggingFaceAuthPanel } from './components/HuggingFaceAuthPanel'
import { ImagePipelineSidebar } from './components/ImagePipelineSidebar'
import { OnCanvasNodePicker } from './components/OnCanvasNodePicker'
import { PipelineRegions } from './components/PipelineRegions'
import { overrides, PipelineToolbar } from './components/PipelineToolbar'
import {
	ConnectionBindingUtil,
	createOrUpdateConnectionBinding,
} from './connection/ConnectionBindingUtil'
import { ConnectionShapeUtil } from './connection/ConnectionShapeUtil'
import { keepConnectionsAtBottom } from './connection/keepConnectionsAtBottom'
import { disableTransparency } from './disableTransparency'
import { NodeShapeUtil } from './nodes/NodeShapeUtil'
import { PointingPort } from './ports/PointingPort'

declare global {
	interface Window {
		editor?: Editor
	}
}

const shapeUtils = [NodeShapeUtil, ConnectionShapeUtil]
const bindingUtils = [ConnectionBindingUtil]

const components: TLComponents = {
	InFrontOfTheCanvas: () => (
		<>
			<OnCanvasNodePicker />
			<PipelineRegions />
		</>
	),
	Toolbar: PipelineToolbar,
	StylePanel: null,
}

const options: Partial<TldrawOptions> = {
	actionShortcutsLocation: 'menu',
	maxPages: 1,
}

function restrictToNodesAndConnections(editor: Editor) {
	const allowedShapeTypes = new Set(['node', 'connection'])

	const removeDisallowedShapes = () => {
		const disallowedShapeIds = editor
			.getCurrentPageShapes()
			.filter((shape) => !allowedShapeTypes.has(shape.type))
			.map((shape) => shape.id)

		if (disallowedShapeIds.length > 0) {
			editor.deleteShapes(disallowedShapeIds)
		}
	}

	removeDisallowedShapes()

	editor.sideEffects.registerAfterCreateHandler('shape', (shape) => {
		if (!allowedShapeTypes.has(shape.type)) {
			editor.deleteShape(shape.id)
		}
	})
}

function App() {
	const [editor, setEditor] = useState<Editor | null>(null)
	const [selectedExample, setSelectedExample] = useState<'image-generator' | 'image-space'>(
		'image-generator'
	)

	return (
		<div className="image-pipeline-layout" style={{ position: 'fixed', inset: 0 }}>
			<div className="image-pipeline-sidebar">
				<HuggingFaceAuthPanel />
				{editor ? <ImagePipelineSidebar editor={editor} /> : <div />}
			</div>
			<div className="image-pipeline-canvas">
				{editor ? (
					<div className="ExampleSelector">
						<span className="ExampleSelector-label">Examples</span>
						<div className="ExampleSelector-controls">
							<select
								value={selectedExample}
								onChange={(e) =>
									setSelectedExample(e.target.value as 'image-generator' | 'image-space')
								}
							>
								<option value="image-generator">Image generator</option>
								<option value="image-space">Image Space</option>
							</select>
							<button
								type="button"
								onClick={() => {
									loadExample(editor, selectedExample)
								}}
							>
								Load
							</button>
						</div>
					</div>
				) : null}
				<Tldraw
					persistenceKey="huggingui-pipeline-v3"
					options={options}
					overrides={overrides}
					shapeUtils={shapeUtils}
					bindingUtils={bindingUtils}
					components={components}
					onMount={(editor) => {
						window.editor = editor

						setEditor(editor)

						ensureDefaultPipeline(editor)

						// Ensure drag gestures manipulate nodes by default instead of panning.
						editor.setCurrentTool('select')

						editor.user.updateUserPreferences({ isSnapMode: true })

						const selectState = editor.getStateDescendant('select') as
							| {
									children?: Record<string, unknown>
									addChild: (child: typeof PointingPort) => void
							  }
							| undefined
						if (!selectState?.children?.[PointingPort.id]) {
							selectState?.addChild(PointingPort)
						}

						keepConnectionsAtBottom(editor)
						restrictToNodesAndConnections(editor)

						disableTransparency(editor, ['connection'])
					}}
				/>
			</div>
		</div>
	)
}

function ensureDefaultPipeline(editor: Editor) {
	const hasNodeShapes = () => editor.getCurrentPageShapes().some((shape) => shape.type === 'node')

	if (!hasNodeShapes()) {
		createDefaultPipeline(editor)
	}

	// tldraw can hydrate persisted snapshots shortly after mount in production builds.
	// Re-check after hydration and seed a default pipeline if the loaded snapshot is empty.
	window.setTimeout(() => {
		if (!hasNodeShapes()) {
			createDefaultPipeline(editor)
		}
	}, 4000)
}

function loadExample(editor: Editor, example: 'image-generator' | 'image-space') {
	editor.run(() => {
		const allShapeIds = editor.getCurrentPageShapes().map((shape) => shape.id)
		if (allShapeIds.length > 0) {
			editor.deleteShapes(allShapeIds)
		}

		if (example === 'image-space') {
			createImageSpaceExample(editor)
			return
		}

		createImageGeneratorExample(editor)
	})
}

function createConnection(
	editor: Editor,
	fromShapeId: ReturnType<typeof createShapeId>,
	fromPortId: string,
	toShapeId: ReturnType<typeof createShapeId>,
	toPortId: string
) {
	const connectionId = createShapeId()
	editor.createShape({
		id: connectionId,
		type: 'connection',
		props: {
			start: { x: 0, y: 0 },
			end: { x: 120, y: 0 },
		},
	})
	createOrUpdateConnectionBinding(editor, connectionId, fromShapeId, {
		terminal: 'start',
		portId: fromPortId,
	})
	createOrUpdateConnectionBinding(editor, connectionId, toShapeId, {
		terminal: 'end',
		portId: toPortId,
	})
}

function createImageGeneratorExample(editor: Editor) {
	const modelId = createShapeId()
	const textId = createShapeId()
	const generateId = createShapeId()
	const previewId = createShapeId()

	editor.createShapes([
		{
			id: modelId,
			type: 'node',
			x: 120,
			y: 140,
			props: {
				node: {
					type: 'model',
					provider: 'auto',
					modelId: 'black-forest-labs/FLUX.1-schnell',
					spaceId: '',
					spaceApiName: '',
					spaceArgsTemplate: '',
				},
			},
		},
		{
			id: textId,
			type: 'node',
			x: 120,
			y: 400,
			props: {
				node: {
					type: 'text',
					text: 'a cinematic portrait photo of a fox in soft studio lighting',
				},
			},
		},
		{
			id: generateId,
			type: 'node',
			x: 460,
			y: 180,
			props: {
				node: {
					type: 'generate',
					promptText: 'a cinematic portrait photo of a fox in soft studio lighting',
					steps: 20,
					cfgScale: 7,
					seed: 42,
					lastResultUrl: null,
				},
			},
		},
		{
			id: previewId,
			type: 'node',
			x: 840,
			y: 180,
			props: {
				node: {
					type: 'preview',
					lastImageUrl: null,
				},
			},
		},
	])

	createConnection(editor, modelId, 'output', generateId, 'model')
	createConnection(editor, textId, 'output', generateId, 'prompt')
	createConnection(editor, generateId, 'output', previewId, 'image')
}

function createImageSpaceExample(editor: Editor) {
	const spaceId = createShapeId()
	const textId = createShapeId()
	const runSpaceId = createShapeId()
	const previewId = createShapeId()

	const schemaJson = JSON.stringify({
		endpoints: [
			{
				apiName: '/infer',
				parameters: [
					{
						label: 'Prompt',
						parameter_name: 'prompt',
						parameter_has_default: false,
						parameter_default: null,
						type: { type: 'string' },
						component: 'Textbox',
					},
					{
						label: 'Model Size',
						parameter_name: 'model_size',
						parameter_has_default: true,
						parameter_default: '1.6B',
						type: { enum: ['0.6B', '1.6B'], type: 'string' },
						component: 'Radio',
					},
				],
				returns: [
					{
						label: 'Result',
						component: 'Image',
						type: {
							title: 'ImageData',
							type: 'object',
							properties: { path: { type: 'string' }, url: { type: 'string' } },
						},
					},
				],
				show_api: true,
			},
		],
	})

	const argsJson = JSON.stringify({
		prompt: 'A photoreal mountain landscape at sunrise, 35mm photo',
		model_size: '1.6B',
		seed: 0,
		randomize_seed: true,
		width: 1024,
		height: 1024,
		guidance_scale: 4.5,
		num_inference_steps: 2,
	})

	editor.createShapes([
		{
			id: spaceId,
			type: 'node',
			x: 120,
			y: 220,
			props: {
				node: {
					type: 'space',
					spaceId: 'Efficient-Large-Model/SanaSprint',
				},
			},
		},
		{
			id: textId,
			type: 'node',
			x: 120,
			y: 470,
			props: {
				node: {
					type: 'text',
					text: 'A photoreal mountain landscape at sunrise, 35mm photo',
				},
			},
		},
		{
			id: runSpaceId,
			type: 'node',
			x: 460,
			y: 160,
			props: {
				node: {
					type: 'run_space',
					endpoint: '/infer',
					argsJson,
					schemaJson,
					lastResultUrl: null,
					lastResultText: null,
				},
			},
		},
		{
			id: previewId,
			type: 'node',
			x: 860,
			y: 200,
			props: {
				node: {
					type: 'preview',
					lastImageUrl: null,
				},
			},
		},
	])

	createConnection(editor, spaceId, 'output', runSpaceId, 'space')
	createConnection(editor, textId, 'output', runSpaceId, 'param:prompt')
	createConnection(editor, runSpaceId, 'output', previewId, 'image')
}

/**
 * Create a default text-to-image pipeline to get users started.
 */
function createDefaultPipeline(editor: Editor) {
	const modelId = createShapeId()
	const textId = createShapeId()
	const generateId = createShapeId()
	const previewId = createShapeId()

	editor.createShapes([
		{
			id: modelId,
			type: 'node',
			x: 100,
			y: 200,
			props: {
				node: {
					type: 'model',
					provider: 'auto',
					modelId: 'black-forest-labs/FLUX.1-schnell',
					spaceId: '',
					spaceApiName: '/predict',
					spaceArgsTemplate: '["{prompt}"]',
				},
			},
		},
		{
			id: textId,
			type: 'node',
			x: 100,
			y: 450,
			props: {
				node: {
					type: 'text',
					text: 'a photo of a cat sitting on a windowsill',
				},
			},
		},
		{
			id: generateId,
			type: 'node',
			x: 450,
			y: 200,
			props: {
				node: {
					type: 'generate',
					promptText: 'a photo of a cat sitting on a windowsill',
					steps: 20,
					cfgScale: 7,
					seed: Math.floor(Math.random() * 99999),
					lastResultUrl: null,
				},
			},
		},
		{
			id: previewId,
			type: 'node',
			x: 800,
			y: 200,
			props: {
				node: {
					type: 'preview',
					lastImageUrl: null,
				},
			},
		},
	])
}

export default App
