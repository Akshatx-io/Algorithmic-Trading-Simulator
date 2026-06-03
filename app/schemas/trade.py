from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime


class ExecuteTradeRequest(BaseModel):
    symbol: str
    action: str  # BUY or SELL
    quantity: float
    order_type: str = "MARKET"  # MARKET or LIMIT
    limit_price: Optional[float] = None


class TradeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    symbol: str
    action: str
    quantity: float
    price: float
    timestamp: datetime
    status: str
    # Extra context the UI uses to update state without a second round-trip.
    realized_pnl: Optional[float] = None
    balance: Optional[float] = None
