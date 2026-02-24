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

		// Special handling for list_iterator: run downstream node for each item
		if (node.shape.props.node.type === 'list_iterator') {
			await this.executeListIteratorNode(nodeId, node, inputs)
			return
		}

		this.nodesById.set(nodeId, {
			...node,
			state: 'executing',
		})

		this.editor.updateShape({
			id: nodeId,
			type: node.shape.type,
			props: { isOutOfDate: true, isExecuting: true },
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
				props: { isOutOfDate: false, isExecuting: false },
			})
		}

		const executingDependentPromises = []
		for (const connection of Object.values(node.connections)) {
			if (!connection || connection.terminal !== 'start') continue

			executingDependentPromises.push(this.executeNodeIfReady(connection.connectedShapeId))
		}

		await Promise.all(executingDependentPromises)
	}

	private async executeListIteratorNode(
		nodeId: TLShapeId,
		node: ExecutionGraphNode,
		inputs: Record<string, PipelineValue | PipelineValue[]>
	) {
		const listIteratorNode = node.shape.props.node as {
			type: 'list_iterator'
			items: string
			completedCount: number
			totalCount: number
			lastResultUrl: string | null
		}
		const items = listIteratorNode.items
			.split('\n')
			.map((s) => s.trim())
			.filter((s) => s.length > 0)

		const template = (inputs.template as string) ?? ''

		if (items.length === 0) {
			this.nodesById.set(nodeId, {
				...node,
				state: 'executed',
				outputs: { output: null, current_item: null },
			})
			this.editor.updateShape({
				id: nodeId,
				type: node.shape.type,
				props: {
					node: { ...listIteratorNode, completedCount: 0, totalCount: 0, lastResultUrl: null },
					isOutOfDate: false,
					isExecuting: false,
				},
			})
			return
		}

		this.nodesById.set(nodeId, {
			...node,
			state: 'executing',
		})
		this.editor.updateShape({
			id: nodeId,
			type: node.shape.type,
			props: { isOutOfDate: true, isExecuting: true },
		})

		const downstreamByPort = new Map<string, { shapeId: TLShapeId; portId: string }[]>()
		for (const conn of node.connections) {
			if (!conn || conn.terminal !== 'start') continue
			const list = downstreamByPort.get(conn.ownPortId) ?? []
			list.push({ shapeId: conn.connectedShapeId, portId: conn.connectedPortId })
			downstreamByPort.set(conn.ownPortId, list)
		}

		const currentItemDownstream = downstreamByPort.get('current_item') ?? []
		const outputDownstream = downstreamByPort.get('output') ?? []

		let lastResult: PipelineValue = null

		try {
			for (let i = 0; i < items.length; i++) {
				if (this.state !== 'executing') return

				const item = template ? `${template}, ${items[i]}` : items[i]

				// Reset downstream nodes so they can run again this iteration
				if (i > 0) {
					this.resetDownstreamToWaiting(nodeId)
				}

				const iteratorOutputs: ExecutionResult = {
					current_item: item,
					output: lastResult,
				}

				this.nodesById.set(nodeId, {
					...node,
					state: 'executed',
					outputs: iteratorOutputs,
				})

				// Run downstream of current_item first (e.g. Generate)
				for (const { shapeId } of currentItemDownstream) {
					await this.executeNodeIfReady(shapeId)
				}

				// Get result from downstream - use first current_item downstream's output
				for (const { shapeId } of currentItemDownstream) {
					const executed = this.nodesById.get(shapeId)
					if (executed?.state === 'executed' && executed.outputs) {
						const out = executed.outputs['output'] ?? Object.values(executed.outputs)[0]
						if (out != null) {
							lastResult = out as PipelineValue
							break
						}
					}
				}

				// Update list iterator output for downstream of output port (e.g. Preview)
				iteratorOutputs.output = lastResult
				this.nodesById.set(nodeId, {
					...node,
					state: 'executed',
					outputs: iteratorOutputs,
				})

				// Run downstream of output
				for (const { shapeId } of outputDownstream) {
					await this.executeNodeIfReady(shapeId)
				}

				this.editor.updateShape({
					id: nodeId,
					type: node.shape.type,
					props: {
						node: {
							...listIteratorNode,
							completedCount: i + 1,
							totalCount: items.length,
							lastResultUrl: typeof lastResult === 'string' ? lastResult : null,
						},
						isOutOfDate: i < items.length - 1,
					},
				})
			}

			this.nodesById.set(nodeId, {
				...node,
				state: 'executed',
				outputs: {
					current_item: items[items.length - 1],
					output: lastResult,
				},
			})
		} catch (error) {
			this.nodesById.set(nodeId, {
				...node,
				state: 'failed',
				error: error instanceof Error ? error.message : String(error),
			})
		} finally {
			this.editor.updateShape({
				id: nodeId,
				type: node.shape.type,
				props: { isOutOfDate: false, isExecuting: false },
			})
		}
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

	private resetDownstreamToWaiting(shapeId: TLShapeId) {
		const toReset = new Set<TLShapeId>()
		const toVisit = [shapeId]

		while (toVisit.length > 0) {
			const id = toVisit.pop()!
			if (toReset.has(id)) continue

			const n = this.nodesById.get(id)
			if (!n) continue

			toReset.add(id)
			for (const conn of n.connections) {
				if (!conn || conn.terminal !== 'start') continue
				toVisit.push(conn.connectedShapeId)
			}
		}

		for (const id of toReset) {
			if (id === shapeId) continue
			const n = this.nodesById.get(id)
			if (n && n.state !== 'failed') {
				this.nodesById.set(id, {
					state: 'waiting',
					shape: n.shape,
					connections: n.connections,
				})
			}
		}
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
