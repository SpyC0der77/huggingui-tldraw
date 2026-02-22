import { getSessionFromRequest, hasConfiguredHfToken } from '@/lib/auth/huggingfaceToken'

export async function GET(request: Request) {
	if (hasConfiguredHfToken()) {
		return Response.json({
			authenticated: true,
			authMode: 'env',
			user: {
				name: 'Server token (HF_TOKEN)',
			},
		})
	}

	const session = getSessionFromRequest(request)
	if (!session) {
		return Response.json({ authenticated: false })
	}

	return Response.json({
		authenticated: true,
		authMode: 'oauth',
		expiresAt: session.expiresAt,
		scope: session.scope,
		user: {
			id: session.user?.id,
			name: session.user?.name,
			username: session.user?.username,
			avatarUrl: session.user?.avatarUrl,
		},
	})
}
