import type { NextConfig } from 'next'
import fs from 'node:fs'
import path from 'node:path'

const nextConfig: NextConfig = {
	webpack: (config) => {
		const alias = config.resolve?.alias ?? {}
		const dedupePkgs = [
			'tldraw',
			'@tldraw/editor',
			'@tldraw/state',
			'@tldraw/state-react',
			'@tldraw/store',
			'@tldraw/tlschema',
			'@tldraw/utils',
			'@tldraw/validate',
		]

		for (const pkg of dedupePkgs) {
			alias[pkg] = fs.realpathSync(path.resolve(process.cwd(), 'node_modules', pkg))
		}

		config.resolve = {
			...config.resolve,
			alias,
		}

		return config
	},
}

export default nextConfig
