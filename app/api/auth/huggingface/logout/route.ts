import { cookies } from 'next/headers'
import { HF_SESSION_COOKIE_NAME } from '@/lib/auth/huggingfaceOAuth'
import { deleteSessionById } from '@/lib/auth/huggingfaceSessionStore'
import { getSessionFromRequest } from '@/lib/auth/huggingfaceToken'

export async function POST(request: Request) {
	const session = getSessionFromRequest(request)
	deleteSessionById(session?.id)

	const cookieStore = await cookies()
	cookieStore.delete(HF_SESSION_COOKIE_NAME)

	return Response.json({ ok: true })
}
