import json
from model import EWPredictor

def test_ew_predictor():
    print("Testing EWPredictor...")
    predictor = EWPredictor(num_bands=20, model_type="rf")
    
    # Cold start test
    history = []
    probs, recommended, meta = predictor.predict(history, current_time=0)
    print(f"Cold start - recommended: {recommended}, probs len: {len(probs)}")
    assert len(probs) == 20
    assert 0 <= recommended < 20
    
    # Add simulated periodic signal on band 3 (period 4) and fixed signal on band 7
    # time 0: scan 7 -> HIT
    # time 1: scan 3 -> HIT
    # time 2: scan 0 -> MISS
    # time 3: scan 7 -> HIT
    # time 4: scan 3 -> MISS
    # time 5: scan 3 -> HIT
    history = [
        {"band": 7, "result": 1, "time": 0},
        {"band": 3, "result": 1, "time": 1},
        {"band": 0, "result": 0, "time": 2},
        {"band": 7, "result": 1, "time": 3},
        {"band": 3, "result": 0, "time": 4},
        {"band": 3, "result": 1, "time": 5},
        {"band": 10, "result": 0, "time": 6},
        {"band": 7, "result": 1, "time": 7},
        {"band": 3, "result": 0, "time": 8},
        {"band": 3, "result": 1, "time": 9},
    ]
    
    probs, recommended, meta = predictor.predict(history, current_time=10)
    print(f"Post history - recommended: {recommended}, max prob band: {meta['highest_prob_band']}, prob: {meta['max_probability']}")
    print(f"Probabilities: {probs}")
    print("ML Test Passed Successfully!")

if __name__ == "__main__":
    test_ew_predictor()
