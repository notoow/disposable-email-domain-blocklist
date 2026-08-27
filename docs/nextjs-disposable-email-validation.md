# Next.js disposable email validation

Use the matcher in a server action or route handler. A client-side message may improve UX, but it is not the signup security boundary.

```ts
// app/api/signup/route.ts
import { NextResponse } from 'next/server'
import { isDisposableEmail } from '@internal/disposable-email-core'

export async function POST(request: Request) {
  const body = (await request.json()) as { email?: unknown }
  const email = typeof body.email === 'string' ? body.email : ''

  if (isDisposableEmail(email)) {
    return NextResponse.json(
      { code: 'SIGNUP_EMAIL_NOT_ALLOWED' },
      { status: 400 }
    )
  }

  // Continue with the provider signup only after this server-side check.
  return NextResponse.json({ accepted: true })
}
```

For a production app, keep the provider's own rate limiting, email verification, CAPTCHA, and abuse controls in place. Use a reviewed custom allowlist for known false positives instead of disabling the dataset globally.

