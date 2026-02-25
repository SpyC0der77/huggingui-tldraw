import { Dialog, VisuallyHidden } from 'radix-ui'
import { useCallback, useRef } from 'react'
import {
	TldrawUiButton,
	TldrawUiButtonIcon,
	TldrawUiButtonLabel,
	TldrawUiMenuContextProvider,
	TldrawUiMenuGroup,
	TLShapeId,
	useEditor,
	usePassThroughWheelEvents,
	useQuickReactor,
	useValue,
	Vec,
	VecModel,
} from 'tldraw'
import { getConnectionTerminals } from '../connection/ConnectionShapeUtil'
import { NODE_WIDTH_PX } from '../constants'
import { getNodeDefinitions, NodeType } from '../nodes/nodeTypes'
import { NodeDefinition } from '../nodes/types/shared'
import { EditorAtom } from '../utils'

export interface OnCanvasNodePickerState {
	connectionShapeId: TLShapeId
	location: 'start' | 'end' | 'middle'
	onPick: (nodeType: NodeType, position: VecModel) => void
	onClose: () => void
}

export const onCanvasNodePickerState = new EditorAtom<OnCanvasNodePickerState | null>(
	'on canvas node picker',
	() => null
)

type PickerNodeDefinition = Pick<
	NodeDefinition<{ type: string }>,
	'type' | 'title' | 'icon' | 'getDefault'
>

export function OnCanvasNodePicker() {
	const editor = useEditor()
	const onClose = useCallback(() => {
		const state = onCanvasNodePickerState.get(editor)
		if (!state) return
		onCanvasNodePickerState.set(editor, null)
		state.onClose()
	}, [editor])
	const nodeDefs = getNodeDefinitions(editor)

	return (
		<OnCanvasNodePickerDialog onClose={onClose}>
			<TldrawUiMenuGroup id="inputs">
				<OnCanvasNodePickerItem definition={nodeDefs.model} onClose={onClose} />
				<OnCanvasNodePickerItem definition={nodeDefs.text} onClose={onClose} />
				<OnCanvasNodePickerItem definition={nodeDefs.number} onClose={onClose} />
				<OnCanvasNodePickerItem definition={nodeDefs.boolean} onClose={onClose} />
				<OnCanvasNodePickerItem definition={nodeDefs.space} onClose={onClose} />
				<OnCanvasNodePickerItem definition={nodeDefs.image} onClose={onClose} />
			</TldrawUiMenuGroup>
			<TldrawUiMenuGroup id="process">
				<OnCanvasNodePickerItem definition={nodeDefs.generate} onClose={onClose} />
				<OnCanvasNodePickerItem definition={nodeDefs.run_space} onClose={onClose} />
			</TldrawUiMenuGroup>
			<TldrawUiMenuGroup id="output">
				<OnCanvasNodePickerItem definition={nodeDefs.preview} onClose={onClose} />
			</TldrawUiMenuGroup>
			<TldrawUiMenuGroup id="scripting">
				<OnCanvasNodePickerItem definition={nodeDefs.repeater} onClose={onClose} />
				<OnCanvasNodePickerItem definition={nodeDefs.join} onClose={onClose} />
			</TldrawUiMenuGroup>
		</OnCanvasNodePickerDialog>
	)
}

function OnCanvasNodePickerDialog({
	children,
	onClose,
}: {
	children: React.ReactNode
	onClose: () => void
}) {
	const editor = useEditor()
	const location = useValue('location', () => onCanvasNodePickerState.get(editor)?.location, [
		editor,
	])
	const shouldRender = !!location
	const containerRef = useRef<HTMLDivElement | null>(null)
	usePassThroughWheelEvents(containerRef)

	useQuickReactor(
		'OnCanvasNodePicker',
		() => {
			const state = onCanvasNodePickerState.get(editor)
			if (!state) return

			const container = containerRef.current
			if (!container) return

			const connection = editor.getShape(state.connectionShapeId)
			if (!connection || !editor.isShapeOfType(connection, 'connection')) {
				onClose()
				return
			}

			const terminals = getConnectionTerminals(editor, connection)
			const terminalInConnectionSpace =
				state.location === 'middle'
					? Vec.Lrp(terminals.start, terminals.end, 0.5)
					: terminals[state.location]

			const terminalInPageSpace = editor
				.getShapePageTransform(connection)
				.applyToPoint(terminalInConnectionSpace)

			const terminalInViewportSpace = editor.pageToViewport(terminalInPageSpace)
			container.style.transform = `translate(${terminalInViewportSpace.x}px, ${terminalInViewportSpace.y}px) scale(${editor.getZoomLevel()}) `
		},
		[editor]
	)

	return (
		<Dialog.Root
			open={shouldRender}
			modal={false}
			onOpenChange={(isOpen) => {
				if (!isOpen) onClose()
			}}
		>
			<Dialog.Content
				ref={containerRef}
				className={`OnCanvasNodePicker OnCanvasNodePicker_${location}`}
				style={{ width: NODE_WIDTH_PX }}
			>
				<div className="OnCanvasNodePicker-content">
					<VisuallyHidden.Root>
						<Dialog.Title>Insert node</Dialog.Title>
					</VisuallyHidden.Root>
					<TldrawUiMenuContextProvider sourceId="dialog" type="menu">
						{children}
					</TldrawUiMenuContextProvider>
				</div>
			</Dialog.Content>
		</Dialog.Root>
	)
}

function OnCanvasNodePickerItem({
	definition,
	onClose,
}: {
	definition: PickerNodeDefinition
	onClose: () => void
}) {
	const editor = useEditor()

	return (
		<TldrawUiButton
			key={definition.type}
			type="menu"
			className="OnCanvasNodePicker-button"
			onPointerDown={editor.markEventAsHandled}
			onClick={() => {
				const state = onCanvasNodePickerState.get(editor)
				if (!state) return

				const connection = editor.getShape(state.connectionShapeId)
				if (!connection || !editor.isShapeOfType(connection, 'connection')) {
					onClose()
					return
				}

				const terminals = getConnectionTerminals(editor, connection)
				const terminalInConnectionSpace =
					state.location === 'middle'
						? Vec.Lrp(terminals.start, terminals.end, 0.5)
						: terminals[state.location]

				const terminalInPageSpace = editor
					.getShapePageTransform(connection)
					.applyToPoint(terminalInConnectionSpace)

				state.onPick(definition.getDefault() as NodeType, terminalInPageSpace)

				onClose()
			}}
		>
			<TldrawUiButtonIcon icon={definition.icon} />
			<TldrawUiButtonLabel>{definition.title}</TldrawUiButtonLabel>
		</TldrawUiButton>
	)
}
