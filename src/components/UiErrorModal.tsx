import { useEditor, useValue } from 'tldraw'
import { clearUiError, uiErrorState } from '../errors/uiErrorState'

export function UiErrorModal() {
	const editor = useEditor()
	const currentError = useValue('ui error', () => uiErrorState.get(editor).current, [editor])

	if (!currentError) return null

	return (
		<div className="UiErrorModal-overlay" onPointerDown={(e) => e.stopPropagation()}>
			<div className="UiErrorModal">
				<div className="UiErrorModal-header">
					<h3>{currentError.title}</h3>
					<button type="button" onClick={() => clearUiError(editor)}>
						Close
					</button>
				</div>
				<div className="UiErrorModal-message">{currentError.message}</div>
			</div>
		</div>
	)
}
