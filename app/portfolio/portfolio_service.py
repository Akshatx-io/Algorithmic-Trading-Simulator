from app.market.market_state import market_state

def enrich_positions(positions):

    prices = market_state.get_all_prices() or {}

    enriched = []

    for p in positions:

        current_price = prices.get(p.symbol, p.avg_price)

        enriched.append({
            "symbol": p.symbol,
            "quantity": p.quantity,
            "avg_price": p.avg_price,
            "current_price": current_price,
            "market_value": current_price * p.quantity,
            "pnl": (current_price - p.avg_price) * p.quantity,
            "pnl_percentage": (
                ((current_price - p.avg_price) / p.avg_price) * 100
                if p.avg_price else 0
            )
        })

    return enriched
