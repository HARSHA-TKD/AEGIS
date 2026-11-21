from contextvars import ContextVar

_request_id: ContextVar[str] = ContextVar("aegis_request_id", default="")


def set_request_id(value: str):
    return _request_id.set(value)


def get_request_id() -> str:
    return _request_id.get()


def reset_request_id(token) -> None:
    _request_id.reset(token)
