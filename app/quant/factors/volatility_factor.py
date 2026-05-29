import numpy as np

def volatility_factor(df):

    returns = df["close"].pct_change()

    volatility = returns.rolling(20).std()

    score = volatility.iloc[-1]

    return float(score)