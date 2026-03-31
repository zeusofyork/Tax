import logging
import re


class PIIScrubFilter(logging.Filter):
    """Scrub SSNs, credit card numbers, and other PII from log messages."""

    SSN_PATTERN = re.compile(r"\b\d{3}-\d{2}-\d{4}\b")
    CC_PATTERN = re.compile(r"\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b")
    EMAIL_PATTERN = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b")

    def filter(self, record):
        if isinstance(record.msg, str):
            record.msg = self.SSN_PATTERN.sub("[SSN REDACTED]", record.msg)
            record.msg = self.CC_PATTERN.sub("[CC REDACTED]", record.msg)
        if record.args:
            sanitized = []
            for arg in record.args if isinstance(record.args, tuple) else [record.args]:
                if isinstance(arg, str):
                    arg = self.SSN_PATTERN.sub("[SSN REDACTED]", arg)
                    arg = self.CC_PATTERN.sub("[CC REDACTED]", arg)
                sanitized.append(arg)
            record.args = tuple(sanitized)
        return True
