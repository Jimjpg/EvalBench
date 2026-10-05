import os
import time

from openai import OpenAI


class LLMClient:
    """DeepSeek / Qwen 等 OpenAI 兼容端点的统一封装。"""

    def __init__(self, model, base_url, api_key=None, temperature=0.7):
        self.model = model
        self.temperature = temperature
        self.client = OpenAI(
            api_key=api_key or os.environ.get("LLM_API_KEY"),
            base_url=base_url,
        )

    def chat(self, system, user, max_tokens=4096):
        t0 = time.monotonic()
        resp = self.client.chat.completions.create(
            model=self.model,
            messages=[{"role": "system", "content": system},
                      {"role": "user", "content": user}],
            temperature=self.temperature,
            max_tokens=max_tokens,
        )
        return {
            "text": resp.choices[0].message.content,
            "prompt_tokens": resp.usage.prompt_tokens,
            "completion_tokens": resp.usage.completion_tokens,
            "latency": round(time.monotonic() - t0, 2),
        }
