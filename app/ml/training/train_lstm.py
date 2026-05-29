from app.market.fetch_stock_data import fetch_stock_data
from app.quant.preprocess_data import create_features, create_sequences
from app.quant.build_lstm_model import build_lstm_model


symbol = "AAPL"

df = fetch_stock_data(symbol)

df = create_features(df)

X, y = create_sequences(df)

model = build_lstm_model((X.shape[1], X.shape[2]))

model.fit(
    X,
    y,
    epochs=10,
    batch_size=32
)

model.save("app/quant/lstm_model.h5")