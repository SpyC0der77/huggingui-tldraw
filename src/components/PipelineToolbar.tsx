import {
	HandToolbarItem,
	SelectToolbarItem,
	TldrawUiMenuGroup,
	DefaultToolbar,
} from 'tldraw'
export const overrides = {}

export function PipelineToolbar() {
	return (
		<DefaultToolbar>
			<TldrawUiMenuGroup id="selection">
				<SelectToolbarItem />
				<HandToolbarItem />
			</TldrawUiMenuGroup>
		</DefaultToolbar>
	)
}
