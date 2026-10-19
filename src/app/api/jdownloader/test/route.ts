import { testJDConnection } from "@/lib/jdownloader";

export async function POST(request: Request) {
  const { email, password } = await request.json();
  const result = await testJDConnection(email, password);
  return Response.json(result);
}
