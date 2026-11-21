"""WebSocket /ws/live: pushes the live payload every 5 s, plus immediate event pushes via ``manager``."""
import asyncio
import json
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app import services as svc
from app.db import SessionLocal

log = logging.getLogger(__name__)
router = APIRouter()
PUSH_INTERVAL_S = 5


class ConnectionManager:
    def __init__(self) -> None:
        self.active: set[WebSocket] = set()

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        self.active.add(ws)

    def disconnect(self, ws: WebSocket) -> None:
        self.active.discard(ws)

    async def broadcast(self, message: dict) -> None:
        data = json.dumps(message, default=str)
        for ws in list(self.active):
            try:
                await ws.send_text(data)
            except Exception:
                self.disconnect(ws)


manager = ConnectionManager()


async def snapshot() -> dict:
    async with SessionLocal() as session:
        return await svc.live_payload(session)


@router.websocket("/ws/live")
async def live(ws: WebSocket) -> None:
    await manager.connect(ws)
    try:
        while True:
            await ws.send_text(json.dumps(await snapshot(), default=str))
            try:  # wait for the next interval; any client message triggers an immediate refresh
                await asyncio.wait_for(ws.receive_text(), timeout=PUSH_INTERVAL_S)
            except TimeoutError:
                pass
    except WebSocketDisconnect:
        pass
    except Exception as exc:  # pragma: no cover
        log.warning("ws error: %s", exc)
    finally:
        manager.disconnect(ws)
