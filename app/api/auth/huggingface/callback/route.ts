import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import {
	getHuggingFaceOAuthConfig,
	HF_SESSION_COOKIE_NAME,
	HF_STATE_COOKIE_NAME,
	HF_VERIFIER_COOKIE_NAME,
} from '@/lib/auth/huggingfaceOAuth'
import { createSession } from '@/lib/auth/huggingfaceSessionStore'

interface HuggingFaceTokenResponse {
	access_token: string
	refresh_token?: string
	expires_in?: number
	scope?: string
}

interface HuggingFaceUserInfo {
	sub?: string
	name?: string
	preferred_username?: string
	picture?: string
}

export async function GET(request: Request) {
	const requestUrl = new URL(request.url)
	const code = requestUrl.searchParams.get('code')
	const state = requestUrl.searchParams.get('state')
	const oauthError = requestUrl.searchParams.get('error')
	const cookieStore = await cookies()
	const expectedState = cookieStore.get(HF_STATE_COOKIE_NAME)?.value
	const codeVerifier = cookieStore.get(HF_VERIFIER_COOKIE_NAME)?.value
	const clearEphemeralCookies = () => {
		cookieStore.delete(HF_STATE_COOKIE_NAME)
		cookieStore.delete(HF_VERIFIER_COOKIE_NAME)
	}

	if (oauthError) {
		clearEphemeralCookies()
		return NextResponse.redirect(withAuthStatus(requestUrl, 'error'))
	}

	if (!code || !state || !expectedState || state !== expectedState || !codeVerifier) {
		clearEphemeralCookies()
		return NextResponse.redirect(withAuthStatus(requestUrl, 'invalid_state'))
	}

	try {
		const config = getHuggingFaceOAuthConfig(request)
		const tokenBody = new URLSearchParams({
			grant_type: 'authorization_code',
			code,
			client_id: config.clientId,
			redirect_uri: config.redirectUri,
			code_verifier: codeVerifier,
		})
		if (config.clientSecret) {
			tokenBody.set('client_secret', config.clientSecret)
		}

		const tokenResponse = await fetch(config.tokenUrl, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
			},
			body: tokenBody,
		})

		if (!tokenResponse.ok) {
			const text = await tokenResponse.text()
			throw new Error(`OAuth token exchange failed (${tokenResponse.status}): ${text}`)
		}

		const tokenPayload = (await tokenResponse.json()) as HuggingFaceTokenResponse
		if (!tokenPayload.access_token) {
			throw new Error('OAuth token exchange succeeded but no access_token was returned')
		}

		let userInfo: HuggingFaceUserInfo | undefined
		try {
			const userResponse = await fetch(config.userInfoUrl, {
				headers: {
					Authorization: `Bearer ${tokenPayload.access_token}`,
				},
			})
			if (userResponse.ok) {
				userInfo = (await userResponse.json()) as HuggingFaceUserInfo
			}
		} catch {
			// OAuth remains valid even if profile lookup fails.
		}

		const expiresIn = Math.max(1, tokenPayload.expires_in ?? 3600)
		const session = createSession({
			accessToken: tokenPayload.access_token,
			refreshToken: tokenPayload.refresh_token,
			scope: tokenPayload.scope,
			expiresAt: Date.now() + expiresIn * 1000,
			user: {
				id: userInfo?.sub,
				name: userInfo?.name,
				username: userInfo?.preferred_username,
				avatarUrl: userInfo?.picture,
			},
		})

		const isSecure = process.env.NODE_ENV === 'production'
		cookieStore.set({
			name: HF_SESSION_COOKIE_NAME,
			value: session.id,
			httpOnly: true,
			secure: isSecure,
			sameSite: 'lax',
			path: '/',
			maxAge: expiresIn,
		})
		clearEphemeralCookies()

		return NextResponse.redirect(withAuthStatus(requestUrl, 'ok'))
	} catch {
		clearEphemeralCookies()
		return NextResponse.redirect(withAuthStatus(requestUrl, 'error'))
	}
}

function withAuthStatus(requestUrl: URL, status: string): URL {
	const redirectUrl = new URL('/', requestUrl.origin)
	redirectUrl.searchParams.set('auth', status)
	return redirectUrl
}
