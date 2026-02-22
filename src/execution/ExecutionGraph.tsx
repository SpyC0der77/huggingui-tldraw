import { AtomMap, Editor, TLShapeId } from 'tldraw'
import { NodeShape } from '../nodes/NodeShapeUtil'
import {
	getNodeOutputPortInfo,
	getNodePortConnections,
	getNodePorts,
	NodePortConnection,
} from '../nodes/nodePorts'
import { executeNode } from '../nodes/nodeTypes'
import { ExecutionResult, PipelineValue, STOP_EXECUTION } from '../nodes/types/shared'

interface PendingExecutionGraphNode {
	readonly state: 'waiting' | 'executing'
	readonly shape: NodeShape
	readonly connections: NodePortConnection[]
}
interface ExecutedExecutionGraphNode {
	readonly state: 'executed'
	readonly shape: NodeShape
	readonly connections: NodePortConnection[]
	readonly outputs: ExecutionResult
}
interface FailedExecutionGraphNode {
	readonly state: 'failed'
	readonly shape: NodeShape
	readonly connections: NodePortConnection[]
	readonly error: string
}

type ExecutionGraphNode =
	| PendingExecutionGraphNode
	| ExecutedExecutionGraphNode
	| FailedExecutionGraphNode

export interface ExecutionNodeSnapshot {
	status: 'waiting' | 'executing' | 'executed' | 'failed'
	error: string | null
}

export class ExecutionGraph {
	private readonly nodesById = new AtomMap<TLShapeId, ExecutionGraphNode>('node by id')

	constructor(
		private readonly editor: Editor,
		private readonly startingNodeIds: Set<TLShapeId>
	) {
		const toVisit = Array.from(startingNodeIds)

		while (toVisit.length > 0) {
			const nodeId = toVisit.pop()!
			if (this.nodesById.has(nodeId)) continue

			const node = this.editor.getShape(nodeId)
			if (!node || !this.editor.isShapeOfType(node, 'node')) continue

			const connections = getNodePortConnections(this.editor, node)

			this.nodesById.set(nodeId, {
				state: 'waiting',
				shape: node,
				connections,
			})

			for (const connection of Object.values(connections)) {
				if (!connection || connection.terminal !== 'start') continue
				toVisit.push(connection.connectedShapeId)
			}
		}
	}

	private state: 'waiting' | 'executing' | 'stopped' = 'waiting'

	async execute() {
		if (this.state !== 'waiting') {
			throw new Error('ExecutionGraph can only be executed once')
		}

		this.state = 'executing'
		try {
			const promises = []
			for (const nodeId of this.startingNodeIds) {
				promises.push(this.executeNodeIfReady(nodeId))
			}
			await Promise.all(promises)
		} finally {
			this.state = 'stopped'
		}
	}

	stop() {
		this.state = 'stopped'
	}

	private async executeNodeIfReady(nodeId: TLShapeId) {
		if (this.state !== 'executing') return

		const node = this.nodesById.get(nodeId)
		if (!node || node.state !== 'waiting') return

		const inputs: Record<string, PipelineValue | PipelineValue[]> = {}
		const ports = getNodePorts(this.editor, nodeId)
		const sortedConnections = [...node.connections].sort((a, b) => a.order - b.order)

		for (const connection of sortedConnections) {
			if (!connection || connection.terminal !== 'end') continue

			const dependency = this.nodesById.get(connection.connectedShapeId)
			let value: PipelineValue | STOP_EXECUTION
			if (dependency) {
				if (dependency.state !== 'executed') {
					return
				}

				const output = dependency.outputs[connection.connectedPortId]
				if (output === STOP_EXECUTION) {
					return
				}

				value = output as PipelineValue
			} else {
				const outputs = getNodeOutputPortInfo(this.editor, connection.connectedShapeId)
				const output = outputs[connection.connectedPortId]

				if (!output || output.value === STOP_EXECUTION) {
					return
				}

				value = output.value as PipelineValue
			}

			const port = ports[connection.ownPortId]
			if (port?.multi) {
				const existing = inputs[connection.ownPortId]
				if (Array.isArray(existing)) {
					existing.push(value)
				} else {
					inputs[connection.ownPortId] = [value]
				}
			} else {
				inputs[connection.ownPortId] = value
			}
		}

		this.nodesById.set(nodeId, {
			...node,
			state: 'executing',
		})

		this.editor.updateShape({
			id: nodeId,
			type: node.shape.type,
			props: { isOutOfDate: true },
		})
		try {
			const outputs = await executeNode(this.editor, node.shape, inputs)
			this.nodesById.set(nodeId, {
				...node,
				state: 'executed',
				outputs,
			})
		} catch (error) {
			this.nodesById.set(nodeId, {
				...node,
				state: 'failed',
				error: error instanceof Error ? error.message : String(error),
			})
			return
		} finally {
			this.editor.updateShape({
				id: nodeId,
				type: node.shape.type,
				props: { isOutOfDate: false },
			})
		}

		const executingDependentPromises = []
		for (const connection of Object.values(node.connections)) {
			if (!connection || connection.terminal !== 'start') continue

			executingDependentPromises.push(this.executeNodeIfReady(connection.connectedShapeId))
		}

		await Promise.all(executingDependentPromises)
	}

	getNodeStatus(nodeId: TLShapeId) {
		return this.nodesById.get(nodeId)?.state
	}

	getNodeSnapshot(nodeId: TLShapeId): ExecutionNodeSnapshot | null {
		const node = this.nodesById.get(nodeId)
		if (!node) return null

		return {
			status: node.state,
			error: node.state === 'failed' ? node.error : null,
		}
	}

	getSnapshotByNodeId(): Record<string, ExecutionNodeSnapshot> {
		const snapshot: Record<string, ExecutionNodeSnapshot> = {}

		for (const node of this.nodesById.values()) {
			const failureMessage = this.getBlockingFailureMessage(node)
			snapshot[node.shape.id] = {
				status: node.state,
				error: node.state === 'failed' ? node.error : failureMessage,
			}
		}

		return snapshot
	}

	private getBlockingFailureMessage(node: ExecutionGraphNode): string | null {
		if (node.state !== 'waiting') return null

		for (const connection of node.connections) {
			if (connection.terminal !== 'end') continue

			const dependency = this.nodesById.get(connection.connectedShapeId)
			if (dependency?.state === 'failed') {
				return `Blocked by upstream failure (${dependency.shape.props.node.type}).`
			}
		}

		return null
	}
}
