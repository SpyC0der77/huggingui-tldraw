import { Editor, TLShapeId } from 'tldraw'
import { EditorAtom } from '../utils'
import { ExecutionGraph, ExecutionNodeSnapshot } from './ExecutionGraph'

export interface ExecutionState {
	runningGraph: ExecutionGraph | null
	lastRunByNode: Record<string, ExecutionNodeSnapshot>
	runId: number
	lastCompletedRunId: number
}

export const executionState = new EditorAtom<ExecutionState>('execution state', () => ({
	runningGraph: null,
	lastRunByNode: {},
	runId: 0,
	lastCompletedRunId: 0,
}))

export async function startExecution(editor: Editor, startingNodeIds: Set<TLShapeId>) {
	const graph = new ExecutionGraph(editor, startingNodeIds)
	const runId = executionState.get(editor).runId + 1
	executionState.update(editor, (state) => {
		state.runningGraph?.stop()
		return {
			...state,
			runningGraph: graph,
			lastRunByNode: graph.getSnapshotByNodeId(),
			runId,
		}
	})
	try {
		await graph.execute()
	} finally {
		executionState.update(editor, (state) => {
			if (state.runningGraph !== graph) return state
			return {
				...state,
				runningGraph: null,
				lastRunByNode: graph.getSnapshotByNodeId(),
				lastCompletedRunId: runId,
			}
		})
	}
}

export function stopExecution(editor: Editor) {
	executionState.update(editor, (state) => {
		if (!state.runningGraph) return state
		const snapshot = state.runningGraph.getSnapshotByNodeId()
		state.runningGraph.stop()
		return {
			...state,
			runningGraph: null,
			lastRunByNode: snapshot,
			lastCompletedRunId: state.runId,
		}
	})
}
