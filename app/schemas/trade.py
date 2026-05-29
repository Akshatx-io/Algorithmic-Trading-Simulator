from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class ExecuteTradeRequest(BaseModel):
    symbol: str
    action: str  # BUY or SELL
    quantity: float
    order_type: str  # MARKET or LIMIT
    limit_price: Optional[float] = None


class TradeResponse(BaseModel):
    id: int
    symbol: str
    action: str
    quantity: float
    price: float
    timestamp: datetime
    status: str

    class Config:
        from_attributes = True
