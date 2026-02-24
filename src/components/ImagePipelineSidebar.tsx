import { useRef } from 'react'
import { createShapeId, Editor, getPointerInfo, onDragFromToolbarToCreateShape, Vec } from 'tldraw'
import { getNodeDefinitions, NodeType } from '../nodes/nodeTypes'

const CATEGORY_LABELS: Record<string, string> = {
	input: 'Input',
	process: 'Process',
	output: 'Output',
	scripting: 'Scripting',
	utility: 'Utility',
}

const CATEGORY_ORDER = ['input', 'process', 'output', 'scripting', 'utility']

const DRAG_DISTANCE_SQ = 36 // 6px

/*
 * Task selector is intentionally disabled for now.
 * Keep this scaffold commented so it can be restored quickly.
 *
 * const TASK_MODE_STORAGE_KEY = 'huggingui-task-mode'
 * type TaskMode = 'text-to-image' | 'image-to-image' | 'text-to-text' | 'image-to-text'
 * const TASK_OPTIONS: { id: TaskMode; label: string }[] = [
 *   { id: 'image-to-image', label: 'Image-to-image' },
 *   { id: 'text-to-image', label: 'Text-to-image' },
 *   { id: 'text-to-text', label: 'Text-to-text' },
 *   { id: 'image-to-text', label: 'Image-to-text' },
 * ]
 * const TASK_NODE_WHITELIST: Record<TaskMode, Set<string>> = {
 *   'image-to-image': new Set(['model', 'image', 'prompt', 'generate', 'preview']),
 *   'text-to-image': new Set(['model', 'prompt', 'generate', 'preview']),
 *   'text-to-text': new Set(['prompt']),
 *   'image-to-text': new Set(['image']),
 * }
 */

function createNodeAtCenter(editor: Editor, node: NodeType) {
	const shapeId = createShapeId()
	editor.run(() => {
		editor.createShape({
			id: shapeId,
			type: 'node',
			props: { node },
		})
		const shapeBounds = editor.getShapePageBounds(shapeId)!
		const center = editor.getViewportPageBounds().center
		editor.updateShape({
			id: shapeId,
			type: 'node',
			x: center.x - shapeBounds.width / 2,
			y: center.y - shapeBounds.height / 2,
		})
		editor.select(shapeId)
	})
}

function SidebarItem({
	editor,
	title,
	icon,
	getDefault,
}: {
	editor: Editor
	title: string
	icon: React.ReactElement
	getDefault: () => NodeType
}) {
	const stateRef = useRef<
		| { name: 'idle' }
		| { name: 'pointing'; start: { x: number; y: number } }
		| { name: 'dragging' }
		| { name: 'dragged' }
	>({ name: 'idle' })

	return (
		<button
			className="ImagePipelineSidebar-item"
			onPointerDown={(e) => {
				stateRef.current = {
					name: 'pointing',
					start: { x: e.clientX, y: e.clientY },
				}
				e.currentTarget.setPointerCapture(e.pointerId)
			}}
			onPointerMove={(e) => {
				if (stateRef.current.name === 'pointing') {
					const dist = Vec.Dist2(stateRef.current.start, {
						x: e.clientX,
						y: e.clientY,
					})
					if (dist > DRAG_DISTANCE_SQ) {
						const start = stateRef.current.start
						stateRef.current = { name: 'dragging' }

						editor.run(() => {
							editor.setCurrentTool('select')
							editor.dispatch({
								type: 'pointer',
								target: 'canvas',
								name: 'pointer_down',
								...getPointerInfo(editor, e.nativeEvent),
								point: start,
							})
							editor.selectNone()
							onDragFromToolbarToCreateShape(
								editor,
								{
									type: 'pointer',
									target: 'canvas',
									name: 'pointer_move',
									...getPointerInfo(editor, e.nativeEvent),
									point: start,
								},
								{
									createShape: (id) => {
										editor.createShape({
											id,
											type: 'node',
											props: { node: getDefault() },
										})
									},
								}
							)
							editor.getContainer().focus()
						})
					}
				}
			}}
			onPointerUp={(e) => {
				e.currentTarget.releasePointerCapture(e.pointerId)
				if (stateRef.current.name === 'dragging') {
					editor.dispatch({
						type: 'pointer',
						target: 'canvas',
						name: 'pointer_up',
						...getPointerInfo(editor, e.nativeEvent),
					})
					stateRef.current = { name: 'dragged' }
					return
				}
				stateRef.current = { name: 'idle' }
			}}
			onClick={() => {
				if (stateRef.current.name === 'dragged') {
					stateRef.current = { name: 'idle' }
					return
				}
				stateRef.current = { name: 'idle' }
				createNodeAtCenter(editor, getDefault())
			}}
		>
			<span className="ImagePipelineSidebar-item-icon">{icon}</span>
			<span className="ImagePipelineSidebar-item-title">{title}</span>
		</button>
	)
}

export function ImagePipelineSidebar({ editor }: { editor: Editor }) {
	const defs = getNodeDefinitions(editor)

	// Group definitions by category
	const grouped: Record<string, (typeof defs)[keyof typeof defs][]> = {}
	for (const def of Object.values(defs)) {
		const cat = def.category
		if (!grouped[cat]) grouped[cat] = []
		if (def.hidden) continue
		grouped[cat].push(def)
	}

	return (
		<div className="ImagePipelineSidebar tl-theme__light">
			{/* Task selector intentionally disabled.
			<div className="ImagePipelineSidebar-task">
				<div className="ImagePipelineSidebar-task-label">Task</div>
				<div className="ImagePipelineSidebar-task-badges" role="tablist" aria-label="Task mode">
					{TASK_OPTIONS.map((option) => {
						const isActive = option.id === taskMode
						return (
							<button
								key={option.id}
								type="button"
								role="tab"
								aria-selected={isActive}
								onClick={() => onTaskModeChange(option.id)}
								className={cn(
									badgeVariants({ variant: isActive ? 'default' : 'outline' }),
									'ImagePipelineSidebar-task-badge'
								)}
							>
								{option.label}
							</button>
						)
					})}
				</div>
			</div>
			*/}
			<div className="ImagePipelineSidebar-header">Nodes</div>
			<div className="ImagePipelineSidebar-list">
				{CATEGORY_ORDER.map((cat) => {
					const items = grouped[cat]
					if (!items?.length) return null
					return (
						<div key={cat} className="ImagePipelineSidebar-group">
							<div className="ImagePipelineSidebar-category">{CATEGORY_LABELS[cat] ?? cat}</div>
							{items.map((def) => (
								<SidebarItem
									key={def.type}
									editor={editor}
									title={def.title}
									icon={def.icon}
									getDefault={() => def.getDefault()}
								/>
							))}
						</div>
					)
				})}
			</div>
		</div>
	)
}
