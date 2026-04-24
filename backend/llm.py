"""
LLM streaming adapters — Ollama (local), Anthropic, OpenAI.
Each function is an async generator that yields text tokens.
"""
import json
from typing import AsyncGenerator

import httpx


async def stream_ollama(
    model: str,
    messages: list[dict],
    ollama_url: str = "http://localhost:11434",
) -> AsyncGenerator[str, None]:
    async with httpx.AsyncClient(timeout=120) as client:
        async with client.stream(
            "POST",
            f"{ollama_url}/api/chat",
            json={"model": model, "messages": messages, "stream": True},
        ) as resp:
            resp.raise_for_status()
            async for line in resp.aiter_lines():
                if not line:
                    continue
                data = json.loads(line)
                content = data.get("message", {}).get("content", "")
                if content:
                    yield content
                if data.get("done"):
                    break


async def stream_anthropic(
    model: str,
    messages: list[dict],
    api_key: str,
    system: str,
) -> AsyncGenerator[str, None]:
    import anthropic

    client = anthropic.AsyncAnthropic(api_key=api_key)
    async with client.messages.stream(
        model=model,
        max_tokens=2048,
        system=system,
        messages=messages,
    ) as stream:
        async for token in stream.text_stream:
            yield token


async def stream_openai(
    model: str,
    messages: list[dict],
    api_key: str,
) -> AsyncGenerator[str, None]:
    from openai import AsyncOpenAI

    client = AsyncOpenAI(api_key=api_key)
    stream = await client.chat.completions.create(
        model=model, messages=messages, stream=True
    )
    async for chunk in stream:
        delta = chunk.choices[0].delta.content
        if delta:
            yield delta
