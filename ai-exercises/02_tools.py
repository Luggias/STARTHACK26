"""
02 – Tool Use: Let Claude call your functions
==============================================
What you learn here:
  - Define tools (functions) that Claude is allowed to call
  - Understand the two-step flow:
      Step 1: Claude decides which tool to call and with what arguments
      Step 2: You run the tool and return the result to Claude
  - Practical example: weather tool and calculator

Why this matters for hackathons:
  Tool Use lets you connect Claude to real APIs, databases, or any
  Python function — making it far more powerful than plain chat.
"""

import json
import anthropic
from dotenv import load_dotenv

load_dotenv()

client = anthropic.Anthropic()


# ── Your actual Python functions (the "real" tools) ──────────────────────────

def get_weather(city: str) -> dict:
    """Simulated weather tool (a real version would call a weather API here)."""
    mock_data = {
        "Vienna": {"temp": 12, "condition": "cloudy", "humidity": 65},
        "St. Gallen": {"temp": 8, "condition": "rainy", "humidity": 80},
    }
    return mock_data.get(city, {"temp": 15, "condition": "sunny", "humidity": 50})


def calculate(expression: str) -> dict:
    """Simple calculator."""
    try:
        result = eval(expression, {"__builtins__": {}})
        return {"result": result, "expression": expression}
    except Exception as e:
        return {"error": str(e)}


# Mapping: tool name → Python function
TOOLS_MAP = {
    "get_weather": get_weather,
    "calculate": calculate,
}


# ── Tool definitions for Claude (JSON Schema format) ─────────────────────────

TOOLS = [
    {
        "name": "get_weather",
        "description": "Returns current weather for a city.",
        "input_schema": {
            "type": "object",
            "properties": {
                "city": {
                    "type": "string",
                    "description": "Name of the city, e.g. 'Vienna' or 'St. Gallen'"
                }
            },
            "required": ["city"]
        }
    },
    {
        "name": "calculate",
        "description": "Evaluates a mathematical expression.",
        "input_schema": {
            "type": "object",
            "properties": {
                "expression": {
                    "type": "string",
                    "description": "Math expression, e.g. '42 * 7 + 100'"
                }
            },
            "required": ["expression"]
        }
    }
]


# ── The tool use loop ─────────────────────────────────────────────────────────

def run_with_tools(user_message: str):
    print(f"Question: {user_message}\n")

    messages = [{"role": "user", "content": user_message}]

    # Step 1: Claude replies with a tool_use block instead of plain text
    response = client.messages.create(
        model="claude-opus-4-6",
        max_tokens=512,
        tools=TOOLS,
        messages=messages
    )

    print(f"Stop reason: {response.stop_reason}")  # "tool_use" when a tool is requested

    # Step 2: Execute tools as long as Claude keeps requesting them
    while response.stop_reason == "tool_use":
        tool_results = []

        for block in response.content:
            if block.type == "tool_use":
                print(f"  → Claude calls '{block.name}' with: {block.input}")

                result = TOOLS_MAP[block.name](**block.input)
                print(f"  ← Result: {result}")

                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": block.id,
                    "content": json.dumps(result)
                })

        # Add Claude's response + tool results to the conversation, then continue
        messages.append({"role": "assistant", "content": response.content})
        messages.append({"role": "user", "content": tool_results})

        response = client.messages.create(
            model="claude-opus-4-6",
            max_tokens=512,
            tools=TOOLS,
            messages=messages
        )

    # Print final answer
    for block in response.content:
        if hasattr(block, "text"):
            print(f"\nClaude: {block.text}")


# ── Run examples ──────────────────────────────────────────────────────────────

print("=== Example 1: Weather ===")
run_with_tools("What is the weather in Vienna? Is it warm enough for a t-shirt?")

print("\n=== Example 2: Calculator ===")
run_with_tools("If a team of 3 works 8 hours a day, how many hours is that over a 36-hour hackathon?")

print("\n=== Example 3: Multiple tools ===")
run_with_tools("What is 15 * 4 and what is the weather in St. Gallen?")
