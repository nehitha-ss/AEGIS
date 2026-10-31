/** Trusted hosting configuration, not an Origin supplied by a browser. */
export function expectedBrowserOrigin(request: Request) {
  return process.env.RENDER_EXTERNAL_HOSTNAME
    ? `https://${process.env.RENDER_EXTERNAL_HOSTNAME}`
    : new URL(request.url).origin;
}
