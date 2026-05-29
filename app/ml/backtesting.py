import numpy as np

def backtest_strategy(df, initial_balance=10000):
    balance = initial_balance
    position = 0
    equity_curve = []

    for i in range(len(df)):
        signal = df['signal'].iloc[i]
        price = df['close'].iloc[i]

        if signal == 1 and position == 0:
            position = balance / price
            balance = 0

        elif signal == -1 and position > 0:
            balance = position * price
            position = 0

        equity = balance + position * price
        equity_curve.append(equity)

    df['equity'] = equity_curve
    df['returns'] = df['equity'].pct_change().fillna(0)

    total_return = (df['equity'].iloc[-1] - initial_balance) / initial_balance
    sharpe_ratio = np.mean(df['returns']) / (np.std(df['returns']) + 1e-9)

    return df, total_return, sharpe_ratio
