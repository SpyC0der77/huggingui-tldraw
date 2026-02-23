import { useState } from 'react'
import { TLShapeId, useEditor, useValue } from 'tldraw'
import { executionState } from '../execution/executionState'
import { getNodeDefinition } from '../nodes/nodeTypes'

interface FailedNodeEntry {
	nodeId: TLShapeId
	label: string
	error: string
}

export function ExecutionErrorModal() {
	const editor = useEditor()
	const failedNodes = useValue(
		'failed nodes',
		() => {
			const { lastRunByNode } = executionState.get(editor)
			const items: FailedNodeEntry[] = []

			for (const [nodeId, snapshot] of Object.entries(lastRunByNode)) {
				if (snapshot.status !== 'failed' || !snapshot.error) continue

				const shape = editor.getShape(nodeId as TLShapeId)
				if (!shape || !editor.isShapeOfType(shape, 'node')) continue

				const definition = getNodeDefinition(editor, shape.props.node)
				items.push({
					nodeId: nodeId as TLShapeId,
					label: definition.heading ?? definition.title,
					error: snapshot.error,
				})
			}

			return items
		},
		[editor]
	)
	const lastCompletedRunId = useValue(
		'last completed run id',
		() => executionState.get(editor).lastCompletedRunId,
		[editor]
	)

	const [dismissedRunId, setDismissedRunId] = useState(0)
	const isOpen = failedNodes.length > 0 && lastCompletedRunId > dismissedRunId

	if (!isOpen || failedNodes.length === 0) return null

	return (
		<div className="ExecutionErrorModal-overlay" onPointerDown={(e) => e.stopPropagation()}>
			<div className="ExecutionErrorModal">
				<div className="ExecutionErrorModal-header">
					<h3>Pipeline errors</h3>
					<button type="button" onClick={() => setDismissedRunId(lastCompletedRunId)}>
						Close
					</button>
				</div>
				<div className="ExecutionErrorModal-list">
					{failedNodes.map((entry) => (
						<div key={entry.nodeId} className="ExecutionErrorModal-item">
							<div className="ExecutionErrorModal-itemTitle">{entry.label}</div>
							<div className="ExecutionErrorModal-itemMessage">{entry.error}</div>
						</div>
					))}
				</div>
			</div>
		</div>
	)
}
