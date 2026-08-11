"""Deterministic test server for E2E tests."""

from __future__ import annotations

import asyncio
import json
from collections.abc import AsyncIterator
from typing import Literal

from starlette.applications import Starlette
from starlette.requests import Request
from starlette.responses import JSONResponse, Response
from starlette.routing import Route

from pydantic_ai import Agent, ModelRetry
from pydantic_ai.messages import ModelMessage, RetryPromptPart, ToolReturnPart
from pydantic_ai.models.function import AgentInfo, DeltaThinkingPart, DeltaToolCall, FunctionModel
from pydantic_ai.tools import DeferredToolRequests
from pydantic_ai.ui.vercel_ai import VercelAIAdapter
from pydantic_ai.ui.vercel_ai._event_stream import VercelAIEventStream

agent = Agent(output_type=[str, DeferredToolRequests])


@agent.tool_plain
def get_weather(city: str) -> str:
    """Get weather for a city."""
    if not city:
        raise ModelRetry("City name is required")
    return f"Weather in {city}: Sunny, 72°F"


@agent.tool_plain
def calculate(expression: str) -> str:
    """Calculate a math expression."""
    return "Result: 42"


@agent.tool_plain(requires_approval=True)
def send_email(to: str, body: str) -> str:
    """Send an email to a recipient."""
    return f"Email sent to {to}"


@agent.tool_plain
def run_code(code: str, restart: bool = False) -> dict[str, object]:
    """Run a snippet of Python code."""
    return {"output": "hello world\n", "result": 42}


@agent.tool_plain
def large_output() -> dict[str, object]:
    """Return a tool output large enough to exceed the lazy-render threshold."""
    return {"summary": "large_result_marker", "payload": "x" * 22000}


def _has_tool_return(messages: list[ModelMessage]) -> bool:
    return any(isinstance(p, ToolReturnPart) for msg in messages for p in msg.parts)


def _has_retry_prompt(messages: list[ModelMessage]) -> bool:
    return any(isinstance(p, RetryPromptPart) for msg in messages for p in msg.parts)


def _first_tool_return_content(messages: list[ModelMessage]) -> str:
    return next(
        (str(p.content) for msg in messages for p in msg.parts if isinstance(p, ToolReturnPart)),
        "",
    )


async def stream_text(
    messages: list[ModelMessage], info: AgentInfo
) -> AsyncIterator[str]:
    yield "Hello from the test server!"


async def stream_slow(
    messages: list[ModelMessage], info: AgentInfo
) -> AsyncIterator[str]:
    """Streams slowly so specs can observe in-flight UI (thinking indicator, stop button)."""
    await asyncio.sleep(1.0)
    for chunk in ["Taking ", "my ", "time ", "here."]:
        yield chunk
        await asyncio.sleep(0.6)


async def stream_reasoning(
    messages: list[ModelMessage], info: AgentInfo
) -> AsyncIterator[str | dict[int, DeltaThinkingPart]]:
    """Emits a thinking part before the answer, so specs can exercise the reasoning UI.

    Structured the way reasoning models summarise their steps — a heading per
    step, then its body — which is what the trace timeline renders from.
    """
    # Paced like `stream_slow`: without a gap the whole stream can arrive in one
    # read, so the UI never observes a streaming state and reports no duration.
    yield {0: DeltaThinkingPart(content="**Understanding the question**\n")}
    await asyncio.sleep(0.4)
    yield {0: DeltaThinkingPart(content="Working through the question step by step.\n\n")}
    await asyncio.sleep(0.4)
    yield {0: DeltaThinkingPart(content="**Weighing the options**\n")}
    await asyncio.sleep(0.4)
    yield {0: DeltaThinkingPart(content="The answer follows from the premise.")}
    await asyncio.sleep(0.4)
    yield "Here is the considered answer."


async def stream_failure(
    messages: list[ModelMessage], info: AgentInfo
) -> AsyncIterator[str]:
    """Fails the run itself, so specs can exercise the request-failure UI.

    The message is deliberately long and multi-line, the shape a provider error
    actually arrives in — that is what the error card's summary/details split is
    for.
    """
    yield "Working on it"
    await asyncio.sleep(0.2)
    raise RuntimeError(
        "Upstream provider returned 503 Service Unavailable.\n"
        "request_id=req_8f2c41ab-77de-4d0e-9a11-6bc2d0f4e7c3\n"
        "The model endpoint is temporarily overloaded. Retrying in a few seconds usually succeeds."
    )


async def stream_markdown(
    messages: list[ModelMessage], info: AgentInfo
) -> AsyncIterator[str]:
    """Markdown exercising the two lazily-loaded renderers: a fenced code block pulls a
    shiki language grammar via dynamic import, and math pulls the KaTeX fonts. The offline
    single-file artifact must render both with no network access."""
    yield "Fenced code block:\n\n```python\ndef greet():\n    return 'offline'\n```\n\nAnd math:\n\n$$\nE = mc^2\n$$\n"


async def stream_tool(
    messages: list[ModelMessage], info: AgentInfo
) -> AsyncIterator[str | dict[int, DeltaToolCall]]:
    if _has_tool_return(messages):
        yield f"Tool result: {_first_tool_return_content(messages)}"
        return
    yield {0: DeltaToolCall(name="get_weather", json_args=json.dumps({"city": "San Francisco"}))}


async def stream_multi_tool(
    messages: list[ModelMessage], info: AgentInfo
) -> AsyncIterator[str | dict[int, DeltaToolCall]]:
    if _has_tool_return(messages):
        yield "All tools completed successfully."
        return
    yield {
        0: DeltaToolCall(name="get_weather", json_args=json.dumps({"city": "San Francisco"})),
        1: DeltaToolCall(name="calculate", json_args=json.dumps({"expression": "2 + 2"})),
    }


async def stream_repeated_tool(
    messages: list[ModelMessage], info: AgentInfo
) -> AsyncIterator[str | dict[int, DeltaToolCall]]:
    if _has_tool_return(messages):
        yield "All weather lookups completed."
        return
    yield {
        0: DeltaToolCall(name="get_weather", json_args=json.dumps({"city": "London"})),
        1: DeltaToolCall(name="get_weather", json_args=json.dumps({"city": "Paris"})),
        2: DeltaToolCall(name="get_weather", json_args=json.dumps({"city": "Tokyo"})),
    }


async def stream_error(
    messages: list[ModelMessage], info: AgentInfo
) -> AsyncIterator[str | dict[int, DeltaToolCall]]:
    if _has_tool_return(messages):
        yield "Error handled."
        return
    if _has_retry_prompt(messages):
        yield "The tool encountered an error."
        return
    yield {0: DeltaToolCall(name="get_weather", json_args=json.dumps({"city": ""}))}


async def stream_run_code(
    messages: list[ModelMessage], info: AgentInfo
) -> AsyncIterator[str | dict[int, DeltaToolCall]]:
    if _has_tool_return(messages):
        yield "The code ran successfully."
        return
    yield {
        0: DeltaToolCall(
            name="run_code",
            json_args=json.dumps({"code": "print('hello world')", "restart": False}),
        )
    }


async def stream_large_output(
    messages: list[ModelMessage], info: AgentInfo
) -> AsyncIterator[str | dict[int, DeltaToolCall]]:
    if _has_tool_return(messages):
        yield "The large output is ready."
        return
    yield {0: DeltaToolCall(name="large_output", json_args="{}")}


def _has_tool_return_for(messages: list[ModelMessage], tool_name: str) -> bool:
    return any(
        isinstance(p, ToolReturnPart) and p.tool_name == tool_name
        for msg in messages
        for p in msg.parts
    )


def _tool_return_outcome(messages: list[ModelMessage], tool_name: str) -> str:
    for msg in messages:
        for p in msg.parts:
            if isinstance(p, ToolReturnPart) and p.tool_name == tool_name:
                return p.outcome
    return ""


async def stream_approval(
    messages: list[ModelMessage], info: AgentInfo
) -> AsyncIterator[str | dict[int, DeltaToolCall]]:
    if _has_tool_return_for(messages, "send_email"):
        outcome = _tool_return_outcome(messages, "send_email")
        if outcome == "denied":
            yield "The email was not sent because you denied the request."
        else:
            yield "The email has been sent successfully."
        return
    yield {
        0: DeltaToolCall(
            name="send_email",
            json_args=json.dumps({"to": "alice@example.com", "body": "Hello from the test!"}),
        )
    }


async def stream_repeated_approval(
    messages: list[ModelMessage], info: AgentInfo
) -> AsyncIterator[str | dict[int, DeltaToolCall]]:
    if _has_tool_return_for(messages, "send_email"):
        yield "Both emails have been sent successfully."
        return
    yield {
        0: DeltaToolCall(
            name="send_email",
            json_args=json.dumps({"to": "alice@example.com", "body": "Hello Alice!"}),
        ),
        1: DeltaToolCall(
            name="send_email",
            json_args=json.dumps({"to": "bob@example.com", "body": "Hello Bob!"}),
        ),
    }


models: dict[str, object] = {
    "text": FunctionModel(stream_function=stream_text),
    "markdown": FunctionModel(stream_function=stream_markdown),
    "slow": FunctionModel(stream_function=stream_slow),
    "failure": FunctionModel(stream_function=stream_failure),
    "reasoning": FunctionModel(stream_function=stream_reasoning),
    "tool": FunctionModel(stream_function=stream_tool),
    "multi-tool": FunctionModel(stream_function=stream_multi_tool),
    "repeated-tool": FunctionModel(stream_function=stream_repeated_tool),
    "error": FunctionModel(stream_function=stream_error),
    "approval": FunctionModel(stream_function=stream_approval),
    "repeated-approval": FunctionModel(stream_function=stream_repeated_approval),
    "run-code": FunctionModel(stream_function=stream_run_code),
    "large-output": FunctionModel(stream_function=stream_large_output),
    "anthropic": "anthropic:claude-haiku-4-5",
    "openai": "openai-responses:gpt-4.1-nano",
    "google": "google:gemini-2.0-flash",
}

SDK_VERSION: Literal[5, 6] = 6


# Builtin tools are advertised per model. Only `text` declares one, so specs
# that select another model keep the plain toolbar.
BUILTIN_TOOLS = [{"id": "web_search", "name": "Web search"}]
MODELS_WITH_BUILTIN_TOOLS = {"text"}


async def configure(request: Request) -> Response:
    model_list = [
        {
            "id": f"function:function::{name}",
            "name": name,
            "builtinTools": [t["id"] for t in BUILTIN_TOOLS] if name in MODELS_WITH_BUILTIN_TOOLS else [],
        }
        for name in models
    ]
    return JSONResponse({"models": model_list, "builtinTools": BUILTIN_TOOLS})


class UsageEventStream(VercelAIEventStream):
    """Attach the run's token usage to the assistant message's metadata.

    The adapter already merges `ModelResponse.metadata` into the `message-metadata`
    chunk, so writing there is all it takes for `UIMessage.metadata.usage` to reach
    the browser. Keys are camelCase to match the rest of the wire format.
    """

    async def handle_run_result(self, event):  # type: ignore[override]
        usage = event.result.usage
        response = event.result.response
        response.metadata = {
            **(response.metadata or {}),
            "usage": {
                "inputTokens": usage.input_tokens,
                "outputTokens": usage.output_tokens,
                "totalTokens": usage.total_tokens,
                "cacheReadTokens": usage.cache_read_tokens,
                "cacheWriteTokens": usage.cache_write_tokens,
                "requests": usage.requests,
                "toolCalls": usage.tool_calls,
            },
        }
        async for chunk in super().handle_run_result(event):
            yield chunk


class UsageAdapter(VercelAIAdapter):
    def build_event_stream(self):  # type: ignore[override]
        return UsageEventStream(
            self.run_input,
            accept=self.accept,
            sdk_version=self.sdk_version,
            server_message_id=self.server_message_id,
        )


async def chat(request: Request) -> Response:
    adapter = await UsageAdapter.from_request(request, agent=agent, sdk_version=SDK_VERSION)
    extra = adapter.run_input.__pydantic_extra__ or {}
    model_id = extra.get("model")
    model_ref = models.get(model_id.split("::")[-1]) if model_id else None
    return await UsageAdapter.dispatch_request(
        request, agent=agent, model=model_ref, sdk_version=SDK_VERSION,
    )


async def options_chat(request: Request) -> Response:
    return Response(status_code=200, headers={
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
    })


app = Starlette(routes=[
    Route("/api/chat", options_chat, methods=["OPTIONS"]),
    Route("/api/chat", chat, methods=["POST"]),
    Route("/api/configure", configure, methods=["GET"]),
])
