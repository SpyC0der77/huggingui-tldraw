import { HF_SESSION_COOKIE_NAME } from './huggingfaceOAuth'
import { getSessionById } from './huggingfaceSessionStore'

export function requireHuggingFaceAccessToken(request: Request): string {
	const token = process.env.HF_TOKEN
	if (token) {
		return token
	}

	const cookieHeader = request.headers.get('cookie') ?? ''
	const sessionId = parseCookie(cookieHeader, HF_SESSION_COOKIE_NAME)
	const session = getSessionById(sessionId)
	if (session?.accessToken) {
		return session.accessToken
	}

	throw new Error(
		'No Hugging Face access token found. Sign in with Hugging Face or set HF_TOKEN.'
	)
}

export function getSessionFromRequest(request: Request) {
	const cookieHeader = request.headers.get('cookie') ?? ''
	const sessionId = parseCookie(cookieHeader, HF_SESSION_COOKIE_NAME)
	return getSessionById(sessionId)
}

export function hasConfiguredHfToken(): boolean {
	return Boolean(process.env.HF_TOKEN)
}

function parseCookie(header: string, name: string): string | undefined {
	const cookies = header.split(';')
	for (const cookie of cookies) {
		const [rawKey, ...rawValue] = cookie.trim().split('=')
		if (rawKey === name) {
			return decodeURIComponent(rawValue.join('='))
		}
	}

	return undefined
}
