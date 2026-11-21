from typing import Literal

from pydantic import Field, field_validator

from app.schemas.common import CamelModel


class ChatMessage(CamelModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=8000)


class AssistantChatRequest(CamelModel):
    messages: list[ChatMessage] = Field(min_length=1, max_length=50)
    page: str | None = Field(default=None, max_length=200)

    @field_validator("messages")
    @classmethod
    def last_message_is_user(cls, value: list[ChatMessage]) -> list[ChatMessage]:
        if value[-1].role != "user":
            raise ValueError("The last message must be from the user.")
        return value


class AssistantAction(CamelModel):
    label: str
    href: str
    tone: str = "default"


class AssistantCitation(CamelModel):
    label: str
    href: str
    snippet: str = ""


class AssistantChatResponse(CamelModel):
    reply: str
    model: str
    provider: str
    actions: list[AssistantAction] = Field(default_factory=list)
    citations: list[AssistantCitation] = Field(default_factory=list)


class AssistantStatus(CamelModel):
    enabled: bool
    provider: str
    model: str
    available: bool
    detail: str
