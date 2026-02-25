import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type ExampleId = 'image-generator' | 'image-space'

interface ExampleSelectorProps {
	selectedExample: ExampleId
	onExampleChange: (example: ExampleId) => void
	onLoad: () => void
}

export function ExampleSelector({
	selectedExample,
	onExampleChange,
	onLoad,
}: ExampleSelectorProps) {
	return (
		<div
			className={cn(
				'absolute z-[200]',
				'top-3.5 right-3.5 max-[900px]:top-2.5 max-[900px]:right-2.5',
				'rounded-lg border border-border bg-card text-card-foreground',
				'shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.02)]',
				'backdrop-blur-sm',
				'p-3 max-[900px]:p-2'
			)}
		>
			<div className="mb-2 px-0.5">
				<span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
					Examples
				</span>
			</div>
			<div className="flex items-center gap-2">
				<select
					value={selectedExample}
					onChange={(e) =>
						onExampleChange(e.target.value as ExampleId)
					}
					className={cn(
						'h-8 min-w-[168px] max-[900px]:min-w-[140px] rounded-md border border-input bg-background px-3 text-sm',
						'shadow-[0_1px_0_0_rgba(255,255,255,0.5)_inset]',
						'outline-none transition-colors',
						'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
						'hover:border-input/80'
					)}
				>
					<option value="image-generator">Image generator</option>
					<option value="image-space">Image Space</option>
				</select>
				<Button type="button" size="sm" onClick={onLoad}>
					Load
				</Button>
			</div>
		</div>
	)
}
