import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { prompt } = await req.json();

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 220,
      temperature: 0.7,
    }),
  });

  if (!res.ok) {
    return NextResponse.json({ error: "Coach unavailable" }, { status: 500 });
  }

  const data = await res.json();
  return NextResponse.json({ text: data.choices[0].message.content });
}
