import { useState } from 'react'
import { createShapeId, Editor, TLComponents, Tldraw, TldrawOptions } from 'tldraw'
import { HuggingFaceAuthPanel } from './components/HuggingFaceAuthPanel.tsx'
import { ImagePipelineSidebar } from './components/ImagePipelineSidebar.tsx'
import { OnCanvasNodePicker } from './components/OnCanvasNodePicker.tsx'
import { PipelineRegions } from './components/PipelineRegions.tsx'
import { overrides, PipelineToolbar } from './components/PipelineToolbar.tsx'
import { ConnectionBindingUtil } from './connection/ConnectionBindingUtil'
import { ConnectionShapeUtil } from './connection/ConnectionShapeUtil'
import { keepConnectionsAtBottom } from './connection/keepConnectionsAtBottom'
import { disableTransparency } from './disableTransparency.tsx'
import { NodeShapeUtil } from './nodes/NodeShapeUtil'
import { PointingPort } from './ports/PointingPort'

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

	return (
		<div className="image-pipeline-layout" style={{ position: 'fixed', inset: 0 }}>
			<div className="image-pipeline-sidebar">
				<HuggingFaceAuthPanel />
				{editor ? <ImagePipelineSidebar editor={editor} /> : <div />}
			</div>
			<div className="image-pipeline-canvas">
				<Tldraw
					persistenceKey="huggingui-pipeline-v3"
					options={options}
					overrides={overrides}
					shapeUtils={shapeUtils}
					bindingUtils={bindingUtils}
					components={components}
					onMount={(editor) => {
						;(window as any).editor = editor

						setEditor(editor)

						// Create a default pipeline if the canvas is empty
						if (!editor.getCurrentPageShapes().some((s) => s.type === 'node')) {
							createDefaultPipeline(editor)
						}

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

/**
 * Create a default text-to-image pipeline to get users started.
 */
function createDefaultPipeline(editor: Editor) {
	const modelId = createShapeId()
	const promptId = createShapeId()
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
			id: promptId,
			type: 'node',
			x: 100,
			y: 450,
			props: {
				node: {
					type: 'prompt',
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
