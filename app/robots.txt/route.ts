export const dynamic = 'force-static'

/** Application privée : aucune indexation. */
export function GET() {
  return new Response('User-agent: *\nDisallow: /\n', { headers: { 'content-type': 'text/plain; charset=utf-8' } })
}
