"""
03 – Vision: Analyze images with Claude
=========================================
What you learn here:
  - Send images via URL or Base64 to Claude
  - Request structured JSON output
  - Practical example: analyze a whiteboard photo (very useful at hackathons!)

Tip: Great for quickly processing photos of whiteboards, diagrams, or mockups.
"""

import base64
import json
import urllib.request
import anthropic
from dotenv import load_dotenv

load_dotenv()

client = anthropic.Anthropic()


# ── Example 1: Image via URL ──────────────────────────────────────────────────
print("=== Example 1: Image via URL ===")

# Simplest approach: pass the URL directly in the content block
response = client.messages.create(
    model="claude-opus-4-6",
    max_tokens=256,
    messages=[
        {
            "role": "user",
            "content": [
                {
                    "type": "image",
                    "source": {
                        "type": "url",
                        "url": "https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/PNG_transparency_demonstration_1.png/280px-PNG_transparency_demonstration_1.png"
                    }
                },
                {
                    "type": "text",
                    "text": "What do you see in this image? Answer in one sentence."
                }
            ]
        }
    ]
)

print(response.content[0].text)
print()


# ── Example 2: Structured JSON output ────────────────────────────────────────
print("=== Example 2: Structured output (JSON) ===")

# Claude can output clean JSON — very useful for further processing
response = client.messages.create(
    model="claude-opus-4-6",
    max_tokens=512,
    system=(
        "You analyze images and ALWAYS return valid JSON. "
        "No text before or after — only JSON."
    ),
    messages=[
        {
            "role": "user",
            "content": [
                {
                    "type": "image",
                    "source": {
                        "type": "url",
                        "url": "https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/PNG_transparency_demonstration_1.png/280px-PNG_transparency_demonstration_1.png"
                    }
                },
                {
                    "type": "text",
                    "text": (
                        'Analyze this image. Return: '
                        '{"description": "...", "colors": [...], "mood": "..."}'
                    )
                }
            ]
        }
    ]
)

raw = response.content[0].text
try:
    parsed = json.loads(raw)
    print(json.dumps(parsed, indent=2))
except json.JSONDecodeError:
    print(f"Response (not valid JSON): {raw}")
print()


# ── Example 3: Local image via Base64 ────────────────────────────────────────
print("=== Example 3: Local image (Base64) ===")
print("Replace 'my_image.jpg' with your own file path.\n")

# Uncomment this block to use a local image:
#
# with open("my_image.jpg", "rb") as f:
#     image_data = base64.standard_b64encode(f.read()).decode("utf-8")
#
# response = client.messages.create(
#     model="claude-opus-4-6",
#     max_tokens=256,
#     messages=[{
#         "role": "user",
#         "content": [
#             {
#                 "type": "image",
#                 "source": {
#                     "type": "base64",
#                     "media_type": "image/jpeg",   # or image/png, image/gif, image/webp
#                     "data": image_data
#                 }
#             },
#             {"type": "text", "text": "What is in this image?"}
#         ]
#     }]
# )

print("Structure for a local image:")
print("""{
    "type": "image",
    "source": {
        "type": "base64",
        "media_type": "image/jpeg",
        "data": "<base64-encoded image bytes>"
    }
}""")
