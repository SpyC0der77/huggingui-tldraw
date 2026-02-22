import crypto from 'node:crypto'

export const HF_OAUTH_COOKIE_PREFIX = 'huggingui_hf_oauth'
export const HF_SESSION_COOKIE_NAME = 'huggingui_hf_session'
export const HF_STATE_COOKIE_NAME = `${HF_OAUTH_COOKIE_PREFIX}_state`
export const HF_VERIFIER_COOKIE_NAME = `${HF_OAUTH_COOKIE_PREFIX}_verifier`

const HUGGING_FACE_AUTHORIZE_URL = 'https://huggingface.co/oauth/authorize'
const HUGGING_FACE_TOKEN_URL = 'https://huggingface.co/oauth/token'
const HUGGING_FACE_USERINFO_URL = 'https://huggingface.co/oauth/userinfo'

export function getHuggingFaceOAuthConfig(request: Request) {
	const clientId = process.env.HF_OAUTH_CLIENT_ID
	if (!clientId) {
		throw new Error('HF_OAUTH_CLIENT_ID is not configured')
	}

	const redirectUri =
		process.env.HF_OAUTH_REDIRECT_URI ??
		`${new URL(request.url).origin}/api/auth/huggingface/callback`
	const scopes = process.env.HF_OAUTH_SCOPES ?? 'openid profile inference-api'

	return {
		clientId,
		clientSecret: process.env.HF_OAUTH_CLIENT_SECRET,
		redirectUri,
		scopes,
		authorizeUrl: HUGGING_FACE_AUTHORIZE_URL,
		tokenUrl: HUGGING_FACE_TOKEN_URL,
		userInfoUrl: HUGGING_FACE_USERINFO_URL,
	}
}

export function generateRandomToken(length: number = 32): string {
	return toBase64Url(crypto.randomBytes(length))
}

export function toCodeChallenge(verifier: string): string {
	return toBase64Url(crypto.createHash('sha256').update(verifier).digest())
}

function toBase64Url(input: Buffer): string {
	return input
		.toString('base64')
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=+$/, '')
}
