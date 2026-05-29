import numpy as np
from sklearn.metrics import mean_squared_error, mean_absolute_percentage_error
from ..ai_engine.mean_reversion_strategy import mean_reversion_strategy
from ..ai_engine.trend_following_strategy import trend_following_strategy

def choose_strategy(df, threshold=0.02):
    df = df.copy()
    df['returns'] = df['close'].pct_change()
    volatility = df['returns'].rolling(20).std().iloc[-1]
    return 'trend_following' if volatility > threshold else 'mean_reversion'

def evaluate_model(y_true, y_pred):
    rmse = np.sqrt(mean_squared_error(y_true, y_pred))
    mape = mean_absolute_percentage_error(y_true, y_pred)
    return rmse, mape

def generate_signals(df, model, look_back, scaler, strategy):
    df = df.copy()

    # Prepare ML input
    X_input = df[['close', 'volume']].values[-look_back:]
    X_input_scaled = scaler.transform(X_input)
    X_input_scaled = X_input_scaled.reshape(1, look_back, 2)

    predicted_scaled = model.predict(X_input_scaled)

    # FIXED inverse transform for multifeature scaler
    temp = np.zeros((1, 2))
    temp[0, 0] = predicted_scaled[0][0]
    predicted_price = scaler.inverse_transform(temp)[0][0]

    # Apply strategy
    if strategy == 'trend_following':
        df = trend_following_strategy(df)
    else:
        df = mean_reversion_strategy(df)

    strategy_signal = df['signal'].iloc[-1]
    current_price = df['close'].iloc[-1]

    # ML confirmation
    if strategy_signal == 1 and predicted_price > current_price:
        final_signal = 1
    elif strategy_signal == -1 and predicted_price < current_price:
        final_signal = -1
    else:
        final_signal = 0

    df.loc[df.index[-1], 'signal'] = final_signal

    return predicted_price, final_signal, df