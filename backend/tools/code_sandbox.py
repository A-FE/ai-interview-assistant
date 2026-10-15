"""
Code sandbox: execute user-submitted code in a restricted subprocess.
Supports Python and JavaScript (Node.js).
"""
import subprocess
import tempfile
import os
import sys
import json
import textwrap
from dataclasses import dataclass
from backend.config import settings


@dataclass
class SandboxResult:
    success: bool
    stdout: str
    stderr: str
    exit_code: int
    timed_out: bool
    score: float  # 0-100


def run_python(code: str, test_cases: list[dict] | None = None) -> SandboxResult:
    """Run Python code with resource limits."""
    wrapper = textwrap.dedent(f"""
import sys, resource

# Limit memory: {settings.sandbox_max_memory_mb} MB
soft = {settings.sandbox_max_memory_mb} * 1024 * 1024
resource.setrlimit(resource.RLIMIT_AS, (soft, soft))

{code}
""")
    if test_cases:
        test_block = "\n# --- test runner ---\n"
        for i, tc in enumerate(test_cases):
            test_block += f"print('CASE_{i}:', {tc['call']})\n"
        wrapper += test_block

    return _run_in_subprocess(wrapper, ["python3", "-c", wrapper], test_cases)


def run_javascript(code: str, test_cases: list[dict] | None = None) -> SandboxResult:
    """Run JavaScript code via Node.js."""
    full_code = code
    if test_cases:
        full_code += "\n// --- test runner ---\n"
        for i, tc in enumerate(test_cases):
            full_code += f"console.log('CASE_{i}:', {tc['call']});\n"

    with tempfile.NamedTemporaryFile(suffix=".js", mode="w", delete=False) as f:
        f.write(full_code)
        tmp_path = f.name

    try:
        result = _run_in_subprocess(full_code, ["node", tmp_path], test_cases)
    finally:
        os.unlink(tmp_path)
    return result


def _run_in_subprocess(code: str, cmd: list[str], test_cases: list[dict] | None) -> SandboxResult:
    try:
        proc = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=settings.sandbox_timeout_seconds,
        )
        timed_out = False
        exit_code = proc.returncode
        stdout = proc.stdout[:2000]  # cap output size
        stderr = proc.stderr[:1000]
    except subprocess.TimeoutExpired:
        return SandboxResult(
            success=False,
            stdout="",
            stderr=f"执行超时（>{settings.sandbox_timeout_seconds}s）",
            exit_code=-1,
            timed_out=True,
            score=0.0,
        )

    success = exit_code == 0

    # Score: base 60 for running, +40 if all test cases pass
    score = 60.0 if success else 0.0
    if success and test_cases:
        passed = sum(
            f"CASE_{i}:" in stdout for i in range(len(test_cases))
        )
        score += 40.0 * passed / len(test_cases)

    return SandboxResult(
        success=success,
        stdout=stdout,
        stderr=stderr,
        exit_code=exit_code,
        timed_out=timed_out,
        score=round(score, 1),
    )


def execute_code(code: str, language: str = "python", test_cases: list[dict] | None = None) -> dict:
    """Public entry point called by the interviewer agent."""
    language = language.lower()
    if language in ("python", "py"):
        result = run_python(code, test_cases)
    elif language in ("javascript", "js", "node"):
        result = run_javascript(code, test_cases)
    else:
        return {
            "success": False,
            "stdout": "",
            "stderr": f"不支持的语言: {language}，当前支持 python / javascript",
            "exit_code": -1,
            "timed_out": False,
            "score": 0.0,
        }

    return {
        "success": result.success,
        "stdout": result.stdout,
        "stderr": result.stderr,
        "exit_code": result.exit_code,
        "timed_out": result.timed_out,
        "score": result.score,
    }
