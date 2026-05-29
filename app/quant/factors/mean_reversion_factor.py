import numpy as np

def mean_reversion_factor(df):

    mean = df["close"].rolling(20).mean()
    std = df["close"].rolling(20).std()

    zscore = (df["close"] - mean) / std

    score = -zscore.iloc[-1]

    return float(score)