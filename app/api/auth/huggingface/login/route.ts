import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import {
	generateRandomToken,
	getHuggingFaceOAuthConfig,
	HF_STATE_COOKIE_NAME,
	HF_VERIFIER_COOKIE_NAME,
	toCodeChallenge,
} from '@/lib/auth/huggingfaceOAuth'

const OAUTH_COOKIE_MAX_AGE_SECONDS = 60 * 10

export async function GET(request: Request) {
	try {
		const config = getHuggingFaceOAuthConfig(request)
		const state = generateRandomToken(24)
		const codeVerifier = generateRandomToken(48)
		const codeChallenge = toCodeChallenge(codeVerifier)
		const authorizeUrl = new URL(config.authorizeUrl)

		authorizeUrl.searchParams.set('response_type', 'code')
		authorizeUrl.searchParams.set('client_id', config.clientId)
		authorizeUrl.searchParams.set('redirect_uri', config.redirectUri)
		authorizeUrl.searchParams.set('scope', config.scopes)
		authorizeUrl.searchParams.set('state', state)
		authorizeUrl.searchParams.set('code_challenge', codeChallenge)
		authorizeUrl.searchParams.set('code_challenge_method', 'S256')

		const cookieStore = await cookies()
		const isSecure = process.env.NODE_ENV === 'production'
		cookieStore.set({
			name: HF_STATE_COOKIE_NAME,
			value: state,
			httpOnly: true,
			secure: isSecure,
			sameSite: 'lax',
			path: '/',
			maxAge: OAUTH_COOKIE_MAX_AGE_SECONDS,
		})
		cookieStore.set({
			name: HF_VERIFIER_COOKIE_NAME,
			value: codeVerifier,
			httpOnly: true,
			secure: isSecure,
			sameSite: 'lax',
			path: '/',
			maxAge: OAUTH_COOKIE_MAX_AGE_SECONDS,
		})

		return NextResponse.redirect(authorizeUrl)
	} catch (error) {
		return NextResponse.json(
			{ error: error instanceof Error ? error.message : 'Failed to start OAuth flow' },
			{ status: 500 }
		)
	}
}
