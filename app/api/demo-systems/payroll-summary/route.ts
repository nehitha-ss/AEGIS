export function GET() {
  return Response.json(
    {
      error: "Direct access denied",
      detail: "This demo company system accepts calls only through the AEGIS tool gateway.",
    },
    { status: 403 },
  );
}
