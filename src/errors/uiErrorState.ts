import { Editor } from 'tldraw'
import { EditorAtom } from '../utils'

export interface UiErrorEntry {
	id: number
	title: string
	message: string
}

interface UiErrorState {
	current: UiErrorEntry | null
	nextId: number
}

export const uiErrorState = new EditorAtom<UiErrorState>('ui error state', () => ({
	current: null,
	nextId: 1,
}))

export function reportUiError(editor: Editor, title: string, message: string) {
	uiErrorState.update(editor, (state) => {
		const id = state.nextId
		return {
			current: { id, title, message },
			nextId: id + 1,
		}
	})
}

export function clearUiError(editor: Editor) {
	uiErrorState.update(editor, (state) => ({
		...state,
		current: null,
	}))
}
