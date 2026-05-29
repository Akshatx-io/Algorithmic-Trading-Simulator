import numpy as np

def trend_factor(df):

    short_ma = df["close"].rolling(5).mean()
    long_ma = df["close"].rolling(20).mean()

    trend_strength = (short_ma - long_ma) / long_ma

    score = trend_strength.iloc[-1]

    return float(score)