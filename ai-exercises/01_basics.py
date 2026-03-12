"""
01 – Basics: Simple chat requests to Claude
============================================
What you learn here:
  - Initialize the API client
  - Send a message and read the response
  - Set a system prompt (give Claude a role)
  - Run a multi-turn conversation

Requirements:
  pip install anthropic python-dotenv
  Create a .env file with: ANTHROPIC_API_KEY=sk-ant-...
"""

import anthropic
from dotenv import load_dotenv

load_dotenv()  # Reads ANTHROPIC_API_KEY from .env automatically

client = anthropic.Anthropic()  # Picks up the key from environment


# ── Example 1: Single message ────────────────────────────────────────────────
print("=== Example 1: Simple message ===")

response = client.messages.create(
    model="claude-opus-4-6",
    max_tokens=256,
    messages=[
        {"role": "user", "content": "Explain what a hackathon is in one sentence."}
    ]
)

# The actual reply lives in response.content[0].text
print(response.content[0].text)
print()


# ── Example 2: System prompt (assign a role) ─────────────────────────────────
print("=== Example 2: System prompt ===")

response = client.messages.create(
    model="claude-opus-4-6",
    max_tokens=256,
    system="You are an enthusiastic startup coach. Always reply motivationally and briefly.",
    messages=[
        {"role": "user", "content": "I am nervous about the hackathon tomorrow."}
    ]
)

print(response.content[0].text)
print()


# ── Example 3: Multi-turn conversation ───────────────────────────────────────
print("=== Example 3: Conversation ===")

# You build the history manually — each message is appended to the list
conversation = [
    {"role": "user", "content": "I need an idea for a hackathon project."},
]

response = client.messages.create(
    model="claude-opus-4-6",
    max_tokens=256,
    messages=conversation
)

assistant_reply = response.content[0].text
print(f"Claude: {assistant_reply}\n")

# Append Claude's reply, then add the next user message
conversation.append({"role": "assistant", "content": assistant_reply})
conversation.append({"role": "user", "content": "Sounds good! What technologies would you recommend?"})

response = client.messages.create(
    model="claude-opus-4-6",
    max_tokens=256,
    messages=conversation
)

print(f"Claude: {response.content[0].text}")
