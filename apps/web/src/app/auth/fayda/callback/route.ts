/**
 * /auth/fayda/callback — Next.js App Router route handler (server side).
 *
 * The citizen authenticates on the real Fayda eSignet page (FIN + real OTP
 * delivered by Fayda), and eSignet redirects the browser back here with
 * `?code=...&state=...`. We exchange those with the backend, which uses a
 * client-assertion JWT and returns the verified identity from userinfo.
 *
 * On success: redirect to `/` with `?fayda=verified&sub=...&name=...&phone=...`
 * (a SignUpTab/registration screen can consume these).
 * On failure: redirect to `/` with `?fayda=error`.
 */

import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<NextResponse> {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');

    if (error || !code || !state) {
        const reason = error || 'missing_code';
        return NextResponse.redirect(
            new URL(`/?fayda=error&reason=${encodeURIComponent(reason)}`, req.url),
        );
    }

    try {
        const res = await fetch(`${API_BASE_URL}/api/v1/auth/fayda/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code, state }),
        });
        const data = await res.json();
        if (!res.ok || !data?.verified) {
            throw new Error(data?.message || 'Fayda verification failed');
        }

        const query = new URLSearchParams({
            fayda: 'verified',
            sub: data.sub ?? '',
            name: data.name ?? '',
            phone: data.phone ?? '',
        });
        return NextResponse.redirect(new URL(`/?${query.toString()}`, req.url));
    } catch (err) {
        const reason = err instanceof Error ? encodeURIComponent(err.message) : 'unknown';
        return NextResponse.redirect(new URL(`/?fayda=error&reason=${reason}`, req.url));
    }
}