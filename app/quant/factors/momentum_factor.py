def momentum_factor(df):

    returns_20 = df["close"].pct_change(20)

    score = returns_20.iloc[-1]

    return float(score)