import { cn } from '@/lib/utils'
import { PORT_TYPE_COLORS, type PortDataType } from '../constants'

const PORT_TYPE_LABELS: Record<PortDataType, string> = {
	image: 'Image',
	text: 'Text',
	model: 'Model',
	space: 'Space',
	number: 'Number',
	boolean: 'Boolean',
	any: 'Any',
}

export function ConnectionColorLegend() {
	return (
		<div
			className={cn(
				'absolute bottom-3 right-3 z-[100] pointer-events-none',
				'rounded-lg border border-border bg-card text-card-foreground',
				'shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.02)]',
				'backdrop-blur-sm',
				'p-3'
			)}
			aria-hidden
		>
			<div className="mb-2 px-0.5">
				<span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
					Connection types
				</span>
			</div>
			<div className="flex flex-col gap-1">
				{(Object.keys(PORT_TYPE_COLORS) as PortDataType[]).map((type) => (
					<div key={type} className="flex items-center gap-1.5">
						<span
							className="size-2.5 shrink-0 rounded-[2px]"
							style={{ backgroundColor: PORT_TYPE_COLORS[type] }}
						/>
						<span className="text-[11px] text-muted-foreground">
							{PORT_TYPE_LABELS[type]}
						</span>
					</div>
				))}
			</div>
		</div>
	)
}
