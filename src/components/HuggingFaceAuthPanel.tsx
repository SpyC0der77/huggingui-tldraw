import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'

interface SessionUser {
	name?: string
	username?: string
}

interface SessionResponse {
	authenticated: boolean
	authMode?: 'env' | 'oauth'
	user?: SessionUser
}

export function HuggingFaceAuthPanel() {
	const [session, setSession] = useState<SessionResponse | null>(null)
	const [isLoading, setIsLoading] = useState(true)

	const refreshSession = useCallback(async () => {
		setIsLoading(true)
		try {
			const response = await fetch('/api/auth/huggingface/session', {
				credentials: 'include',
				cache: 'no-store',
			})
			if (!response.ok) {
				setSession({ authenticated: false })
				return
			}
			setSession((await response.json()) as SessionResponse)
		} catch {
			setSession({ authenticated: false })
		} finally {
			setIsLoading(false)
		}
	}, [])

	useEffect(() => {
		void refreshSession()
	}, [refreshSession])

	const onLogin = () => {
		window.location.href = '/api/auth/huggingface/login'
	}

	const onLogout = async () => {
		setIsLoading(true)
		try {
			await fetch('/api/auth/huggingface/logout', {
				method: 'POST',
				credentials: 'include',
			})
		} finally {
			await refreshSession()
		}
	}

	const identity =
		session?.user?.name ||
		(session?.user?.username ? `@${session.user.username}` : 'Hugging Face account')
	const usingEnvToken = session?.authMode === 'env'

	return (
		<div className="HuggingFaceAuthPanel">
			<div className="HuggingFaceAuthPanel-label">Hugging Face</div>
			{session?.authenticated ? (
				<div className="HuggingFaceAuthPanel-row">
					<span className="HuggingFaceAuthPanel-user">{identity}</span>
					{usingEnvToken ? null : (
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={onLogout}
							disabled={isLoading}
						>
							Log out
						</Button>
					)}
				</div>
			) : (
				<div className="HuggingFaceAuthPanel-row">
					<span className="HuggingFaceAuthPanel-user">
						{isLoading ? 'Checking session...' : 'Not signed in'}
					</span>
					<Button type="button" variant="outline" size="sm" onClick={onLogin} disabled={isLoading}>
						Sign in
					</Button>
				</div>
			)}
		</div>
	)
}
