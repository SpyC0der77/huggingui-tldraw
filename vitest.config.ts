import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
	test: {
		environment: 'node',
		globals: true,
		include: ['**/*.test.ts', '**/*.test.tsx'],
		restoreMocks: true,
		clearMocks: true,
		coverage: {
			provider: 'v8',
			reporter: ['text', 'html'],
			include: ['src/**/*.ts', 'src/**/*.tsx', 'lib/**/*.ts'],
			exclude: ['**/*.test.ts', '**/*.test.tsx', '**/*.d.ts'],
		},
	},
	resolve: {
		alias: {
			'@': path.resolve(__dirname, './'),
		},
	},
})
