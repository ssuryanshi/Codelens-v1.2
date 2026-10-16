"""LLM client for CodeLens.

Historical name: the project originally called Amazon Bedrock (Nova Lite + Titan Embed v2).
The new AWS account has every Bedrock on-demand quota pinned at 0 and marked non-adjustable,
so this module was swapped to Google Gemini. The class name `BedrockClient` is kept so the
handlers do not need to change; file/class rename is tracked as follow-up tech debt.

Public surface (unchanged):
    class BedrockClient
        .ARCHITECTURE_SYSTEM_PROMPT  (instance attribute mirroring the module constant)
        .generate_embedding(text)        -> List[float]
        .invoke_claude(prompt, system_prompt=None, max_tokens=4096, temperature=0.7) -> str
        .invoke_claude_streaming(...)    -> Generator[str, None, None]
        .generate_architecture_summary(repo_structure) -> str
        .explain_file(file_path, code_content, level='intermediate') -> str
        .generate_mermaid_diagram(architecture_summary) -> str
        .answer_question_with_context(question, code_contexts) -> str

    Module-level: ARCHITECTURE_SYSTEM_PROMPT, FILE_EXPLAIN_PROMPT, CHAT_SYSTEM_PROMPT,
                  DIAGRAM_GENERATION_PROMPT, count_tokens, truncate_to_context

Config via environment variables:
    GEMINI_API_KEY        (required) — Google AI Studio key
    GEMINI_LLM_MODEL      (optional, default 'gemini-2.5-flash')
    GEMINI_EMBED_MODEL    (optional, default 'text-embedding-004')
"""
import os
import time
from typing import List, Dict, Any, Optional, Generator

from google import genai
from google.genai import types as genai_types
from google.genai import errors as genai_errors


# Prompt Templates
ARCHITECTURE_SYSTEM_PROMPT = """You are an expert software architect analyzing codebases. Your task is to:

1. Analyze the repository structure and identify architectural patterns (MVC, microservices, layered, etc.)
2. Identify entry points (main files, API endpoints, CLI commands)
3. Map data flow between components
4. Identify key dependencies and their relationships
5. Highlight design patterns and best practices used

Provide a clear, structured analysis that helps developers quickly understand the codebase architecture."""

FILE_EXPLAIN_PROMPT = """Explain the following code file at a {level} level:

File: {file_path}

Code:
```
{code_content}
```

Explanation guidelines for {level} level:
- beginner: Use simple terminology, explain high-level purpose, avoid technical jargon
- intermediate: Include implementation details, design patterns, and how it fits in the system
- advanced: Cover optimization techniques, edge cases, architectural implications, and trade-offs

Provide a clear, concise explanation appropriate for the {level} level."""

CHAT_SYSTEM_PROMPT = """You are an AI assistant helping developers understand a codebase. You have access to relevant code snippets retrieved from the repository.

Guidelines:
1. Answer questions based on the provided code context
2. Cite specific files and line numbers when referencing code
3. If the context doesn't contain enough information, say so clearly
4. Provide code examples when helpful
5. Be concise but thorough

Always reference the source files in your answers."""

DIAGRAM_GENERATION_PROMPT = """Based on the following architecture analysis, generate a Mermaid.js flowchart diagram that visualizes:

1. Major system components
2. Dependencies between components
3. Data flow directions
4. External services or APIs

Architecture Analysis:
{architecture_summary}

Generate ONLY the Mermaid.js diagram code (starting with ```mermaid and ending with ```). Use appropriate diagram types (graph, flowchart, or C4 diagram) based on the architecture."""


_RETRYABLE_STATUS = {429, 500, 502, 503, 504}


class BedrockClient:
    """Gemini-backed LLM client (historical name, see module docstring)."""

    def __init__(self, region: str = 'us-east-1'):
        """Build a Gemini client. `region` is accepted for signature compatibility only."""
        api_key = os.environ.get('GEMINI_API_KEY')
        if not api_key:
            raise RuntimeError(
                "GEMINI_API_KEY is not set. Add it as a Lambda environment variable "
                "(via the SAM parameter GeminiApiKey) and redeploy."
            )
        self.client = genai.Client(api_key=api_key)
        self.llm_model_id = os.environ.get('GEMINI_LLM_MODEL', 'gemini-flash-latest')
        # Fallback model used when the primary LLM returns 5xx/429 after all
        # retries. Flash-Lite has more generous free-tier capacity, so it
        # usually survives a Flash capacity spike. Set to empty to disable.
        self.llm_fallback_model_id = os.environ.get(
            'GEMINI_LLM_FALLBACK_MODEL', 'gemini-flash-lite-latest'
        )
        self.embedding_model_id = os.environ.get('GEMINI_EMBED_MODEL', 'gemini-embedding-001')
        # Native dimension of the embedding model. Handlers use this to size
        # dummy "fetch all" query vectors that must match stored vectors.
        _embed_dims = {
            'gemini-embedding-001': 3072,
            'gemini-embedding-2': 3072,
            'gemini-embedding-2-preview': 3072,
            'text-embedding-004': 768,
        }
        self.embedding_dim = _embed_dims.get(self.embedding_model_id, 3072)
        self.max_retries = 5
        self.base_delay = 1.0  # seconds
        # Mirror module constant on the instance — handlers access it as
        # bedrock_client.ARCHITECTURE_SYSTEM_PROMPT.
        self.ARCHITECTURE_SYSTEM_PROMPT = ARCHITECTURE_SYSTEM_PROMPT

    def _retry_with_backoff(self, func, *args, **kwargs) -> Any:
        for attempt in range(self.max_retries):
            try:
                return func(*args, **kwargs)
            except genai_errors.APIError as e:
                status = getattr(e, 'code', None) or getattr(e, 'status_code', None)
                if status not in _RETRYABLE_STATUS or attempt == self.max_retries - 1:
                    raise
                # 1s, 2s, 4s, 8s, 16s — total budget ~31s before giving up.
                time.sleep(self.base_delay * (2 ** attempt))

    def generate_embedding(self, text: str) -> List[float]:
        """Return embedding vector for `text`.

        Gemini rejects empty inputs with INVALID_ARGUMENT (Bedrock Titan accepted
        them silently). Substitute whitespace for empty chunks so one bad chunk
        doesn't fail a whole ingestion job.
        """
        content = text if (text and text.strip()) else " "
        def _invoke():
            response = self.client.models.embed_content(
                model=self.embedding_model_id,
                contents=content,
            )
            return list(response.embeddings[0].values)
        return self._retry_with_backoff(_invoke)

    def invoke_claude(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        max_tokens: int = 4096,
        temperature: float = 0.7,
    ) -> str:
        """Generate text. Method name kept for handler compatibility.

        Retries 5x with exponential backoff on 429/5xx. If the primary model is
        still exhausted after that, falls back to llm_fallback_model_id (e.g.
        gemini-flash-lite-latest) for one more attempt so a Flash capacity
        spike doesn't kill a live demo.
        """
        config = genai_types.GenerateContentConfig(
            max_output_tokens=max_tokens,
            temperature=temperature,
            system_instruction=system_prompt if system_prompt else None,
        )

        def _invoke_with(model_id):
            response = self.client.models.generate_content(
                model=model_id,
                contents=prompt,
                config=config,
            )
            return response.text or ""

        try:
            return self._retry_with_backoff(_invoke_with, self.llm_model_id)
        except genai_errors.APIError as e:
            status = getattr(e, 'code', None) or getattr(e, 'status_code', None)
            if status in _RETRYABLE_STATUS and self.llm_fallback_model_id:
                print(
                    f"LLM primary {self.llm_model_id} exhausted ({status}); "
                    f"falling back to {self.llm_fallback_model_id}"
                )
                # Retry the fallback too — a free-tier spike can hit both
                # Flash and Flash-Lite at the same time.
                return self._retry_with_backoff(_invoke_with, self.llm_fallback_model_id)
            raise

    def invoke_claude_streaming(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        max_tokens: int = 4096,
        temperature: float = 0.7,
    ) -> Generator[str, None, None]:
        config = genai_types.GenerateContentConfig(
            max_output_tokens=max_tokens,
            temperature=temperature,
            system_instruction=system_prompt if system_prompt else None,
        )
        stream = self.client.models.generate_content_stream(
            model=self.llm_model_id,
            contents=prompt,
            config=config,
        )
        for chunk in stream:
            text = getattr(chunk, 'text', None)
            if text:
                yield text

    def generate_architecture_summary(self, repo_structure: str) -> str:
        prompt = f"""Analyze this repository structure and provide an architecture summary:

{repo_structure}

Identify:
1. Architectural pattern (MVC, microservices, etc.)
2. Entry points
3. Key components and their responsibilities
4. Data flow
5. External dependencies"""
        return self.invoke_claude(
            prompt=prompt,
            system_prompt=ARCHITECTURE_SYSTEM_PROMPT,
            max_tokens=2048,
        )

    def explain_file(
        self,
        file_path: str,
        code_content: str,
        level: str = 'intermediate',
    ) -> str:
        prompt = FILE_EXPLAIN_PROMPT.format(
            level=level,
            file_path=file_path,
            code_content=code_content,
        )
        return self.invoke_claude(prompt=prompt, max_tokens=2048)

    def generate_mermaid_diagram(self, architecture_summary: str) -> str:
        prompt = DIAGRAM_GENERATION_PROMPT.format(architecture_summary=architecture_summary)
        response = self.invoke_claude(prompt=prompt, max_tokens=1024)
        if '```mermaid' in response:
            start = response.find('```mermaid') + 10
            end = response.find('```', start)
            return response[start:end].strip()
        return response.strip()

    def answer_question_with_context(
        self,
        question: str,
        code_contexts: List[Dict[str, str]],
    ) -> str:
        context_str = "\n\n".join([
            f"File: {ctx['file_path']}\n```\n{ctx['content']}\n```"
            for ctx in code_contexts
        ])
        prompt = f"""Question: {question}

Relevant Code Context:
{context_str}

Please answer the question based on the provided code context. Cite specific files when referencing code."""
        return self.invoke_claude(
            prompt=prompt,
            system_prompt=CHAT_SYSTEM_PROMPT,
            max_tokens=2048,
        )


def count_tokens(text: str) -> int:
    """Rough estimate: 4 chars per token."""
    return len(text) // 4


def truncate_to_context(text: str, max_tokens: int) -> str:
    estimated_tokens = count_tokens(text)
    if estimated_tokens <= max_tokens:
        return text
    char_limit = max_tokens * 4
    if len(text) > char_limit:
        return text[:char_limit - 3] + "..."
    return text
