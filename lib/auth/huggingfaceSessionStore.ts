import crypto from 'node:crypto'

export interface HuggingFaceSession {
	id: string
	accessToken: string
	refreshToken?: string
	expiresAt: number
	scope?: string
	user?: {
		id?: string
		name?: string
		username?: string
		avatarUrl?: string
	}
}

declare global {
	var __hugginguiSessions: Map<string, HuggingFaceSession> | undefined
}

const sessionStore = globalThis.__hugginguiSessions ?? new Map<string, HuggingFaceSession>()
if (!globalThis.__hugginguiSessions) {
	globalThis.__hugginguiSessions = sessionStore
}

export function createSession(
	input: Omit<HuggingFaceSession, 'id'>
): HuggingFaceSession {
	const session: HuggingFaceSession = {
		id: crypto.randomBytes(24).toString('hex'),
		...input,
	}
	sessionStore.set(session.id, session)
	pruneExpiredSessions()
	return session
}

export function getSessionById(id: string | undefined): HuggingFaceSession | null {
	if (!id) return null
	const session = sessionStore.get(id)
	if (!session) return null
	if (Date.now() >= session.expiresAt) {
		sessionStore.delete(id)
		return null
	}
	return session
}

export function deleteSessionById(id: string | undefined) {
	if (!id) return
	sessionStore.delete(id)
}

function pruneExpiredSessions() {
	const now = Date.now()
	for (const [id, session] of sessionStore) {
		if (now >= session.expiresAt) {
			sessionStore.delete(id)
		}
	}
}
