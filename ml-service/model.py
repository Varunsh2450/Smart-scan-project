import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from typing import List, Dict, Any, Tuple
import math

class EWPredictor:
    """
    Electronic Warfare Spectrum Predictor.
    Predicts the probability of signal activity across N frequency bands at time t
    based on historical scan observations (band, result, time).
    """

    CANDIDATE_PERIODS = [2, 3, 4, 5, 6, 7, 8, 10, 12, 16]

    def __init__(self, num_bands: int = 20, model_type: str = "rf"):
        self.num_bands = num_bands
        self.model_type = model_type.lower()
        self.rf_model: RandomForestClassifier | None = None
        self.lr_model: LogisticRegression | None = None
        self.is_fitted = False
        self.training_samples_count = 0
        
        # Per-band statistics tracking
        self.band_scans = np.zeros(num_bands, dtype=int)
        self.band_hits = np.zeros(num_bands, dtype=int)
        self.last_scan_time = np.full(num_bands, -1, dtype=int)
        self.last_hit_time = np.full(num_bands, -1, dtype=int)
        self.recent_ema_hits = np.full(num_bands, 0.05, dtype=float) # small prior
        self.last_scanned_band = -1
        self.last_hit_band = -1
        
        # Transition matrix for frequency hopping pattern detection [from_band][to_band]
        self.transition_counts = np.zeros((num_bands, num_bands), dtype=int)

    def reset(self, num_bands: int = 20):
        self.num_bands = num_bands
        self.rf_model = None
        self.lr_model = None
        self.is_fitted = False
        self.training_samples_count = 0
        self.band_scans = np.zeros(num_bands, dtype=int)
        self.band_hits = np.zeros(num_bands, dtype=int)
        self.last_scan_time = np.full(num_bands, -1, dtype=int)
        self.last_hit_time = np.full(num_bands, -1, dtype=int)
        self.recent_ema_hits = np.full(num_bands, 0.05, dtype=float)
        self.last_scanned_band = -1
        self.last_hit_band = -1
        self.transition_counts = np.zeros((num_bands, num_bands), dtype=int)

    def update_history_stats(self, history: List[Dict[str, Any]]):
        """Recompute or update stats from observation history."""
        self.band_scans.fill(0)
        self.band_hits.fill(0)
        self.last_scan_time.fill(-1)
        self.last_hit_time.fill(-1)
        self.recent_ema_hits.fill(0.05)
        self.transition_counts.fill(0)

        prev_hit_band = -1
        for obs in history:
            b = int(obs.get("band", 0))
            res = int(obs.get("result", 0))
            t = int(obs.get("time", 0))
            if 0 <= b < self.num_bands:
                self.band_scans[b] += 1
                if res == 1:
                    self.band_hits[b] += 1
                    self.last_hit_time[b] = t
                    if prev_hit_band != -1 and prev_hit_band != b:
                        self.transition_counts[prev_hit_band][b] += 1
                    prev_hit_band = b
                self.last_scan_time[b] = t
                # Exponential moving average update
                alpha = 0.25
                self.recent_ema_hits[b] = alpha * res + (1.0 - alpha) * self.recent_ema_hits[b]
                self.last_scanned_band = b

        if prev_hit_band != -1:
            self.last_hit_band = prev_hit_band

    def _extract_features(self, band: int, t: int) -> np.ndarray:
        """
        Extract rich feature vector for a candidate band at time t:
        - Normalized band index
        - Harmonic periodicity encodings (sin & cos of t mod T)
        - Historical scan count and empirical hit rate
        - Elapsed time since last scan
        - Elapsed time since last hit
        - Recent exponential moving average of hit activity
        - Hopping transition correlation with last hit band
        """
        feats = []
        # 1. Band index normalized
        feats.append(band / max(1, self.num_bands - 1))
        
        # 2. Harmonic features for periodic signals
        for p in self.CANDIDATE_PERIODS:
            phase = 2.0 * math.pi * (t % p) / p
            feats.append(math.sin(phase))
            feats.append(math.cos(phase))
            
        # 3. Empirical hit rate with Bayesian smoothing
        scans = self.band_scans[band]
        hits = self.band_hits[band]
        smoothed_rate = (hits + 0.1) / (scans + 2.0)
        feats.append(smoothed_rate)
        feats.append(hits / max(1, scans))
        feats.append(math.log1p(scans))

        # 4. Temporal recency features
        dt_scan = (t - self.last_scan_time[band]) if self.last_scan_time[band] >= 0 else 50
        dt_hit = (t - self.last_hit_time[band]) if self.last_hit_time[band] >= 0 else 100
        feats.append(min(1.0, dt_scan / 25.0))
        feats.append(min(1.0, dt_hit / 50.0))
        
        # 5. Short-term activity
        feats.append(self.recent_ema_hits[band])
        
        # 6. Frequency hopping correlation from last hit band
        if self.last_hit_band >= 0:
            tot_from = np.sum(self.transition_counts[self.last_hit_band])
            hop_prob = (self.transition_counts[self.last_hit_band][band] / tot_from) if tot_from > 0 else 0.0
            feats.append(hop_prob)
        else:
            feats.append(0.0)

        return np.array(feats, dtype=float)

    def train_on_history(self, history: List[Dict[str, Any]]):
        """Fit ML model on observation history."""
        self.update_history_stats(history)
        if len(history) < 8:
            self.is_fitted = False
            return

        X = []
        y = []
        for obs in history:
            b = int(obs.get("band", 0))
            res = int(obs.get("result", 0))
            t = int(obs.get("time", 0))
            if 0 <= b < self.num_bands:
                feats = self._extract_features(b, t)
                X.append(feats)
                y.append(res)

        X = np.array(X)
        y = np.array(y)

        # Check if we have at least one 0 and one 1 to train a binary classifier
        unique_classes = np.unique(y)
        if len(unique_classes) > 1:
            try:
                if self.model_type == "lr":
                    model = LogisticRegression(max_iter=200, C=1.0)
                    model.fit(X, y)
                    self.lr_model = model
                else:
                    # Random Forest is highly capable of non-linear modulo/periodic patterns
                    model = RandomForestClassifier(
                        n_estimators=35,
                        max_depth=6,
                        min_samples_split=2,
                        random_state=42
                    )
                    model.fit(X, y)
                    self.rf_model = model
                self.is_fitted = True
                self.training_samples_count = len(y)
            except Exception as e:
                self.is_fitted = False
        else:
            self.is_fitted = False

    def predict(self, history: List[Dict[str, Any]], current_time: int) -> Tuple[List[float], int, Dict[str, Any]]:
        """
        Predict probability of signal presence for all bands at current_time.
        Returns:
            probabilities: list of floats for each band [0..N-1]
            recommended_band: band with best exploration-exploitation utility
            metadata: dict of insights
        """
        self.update_history_stats(history)

        # Retrain model if history is growing
        if len(history) >= 8 and (not self.is_fitted or abs(len(history) - self.training_samples_count) >= 5):
            self.train_on_history(history)

        probs = np.zeros(self.num_bands, dtype=float)
        
        # Calculate raw probabilities
        for b in range(self.num_bands):
            feats = self._extract_features(b, current_time)
            
            p_val = 0.1 # baseline fallback prior
            if self.is_fitted:
                try:
                    model = self.lr_model if (self.model_type == "lr" and self.lr_model) else self.rf_model
                    if model is not None:
                        # Extract probability for class 1 (hit)
                        prob_dist = model.predict_proba([feats])[0]
                        if len(prob_dist) > 1:
                            p_val = float(prob_dist[1])
                        else:
                            p_val = float(model.classes_[0] == 1)
                except Exception:
                    p_val = self.recent_ema_hits[b]
            else:
                # Heuristic prior before model is fitted
                scans = self.band_scans[b]
                hits = self.band_hits[b]
                p_val = (hits + 0.5) / (scans + 2.0)
                # Boost if active recently
                p_val = 0.5 * p_val + 0.5 * self.recent_ema_hits[b]

            # Blend with periodic indicator if recurring
            if self.last_hit_time[b] >= 0:
                dt_hit = current_time - self.last_hit_time[b]
                for p in self.CANDIDATE_PERIODS:
                    if dt_hit > 0 and dt_hit % p == 0:
                        p_val = min(0.98, p_val + 0.25)
                        break

            # Bound probability to [0.01, 0.99]
            probs[b] = float(np.clip(p_val, 0.01, 0.99))

        # =====================================================================
        # COGNITIVE MULTI-THREAT SCHEDULER: ANTI-CAMPING & AGILE PURSUIT
        # =====================================================================
        # In modern Electronic Warfare, a receiver must NEVER camp on a single
        # frequency channel. Once an emitter is intercepted, the receiver must
        # patrol the spectrum, anticipate agile frequency hops, and intercept
        # recurring periodic radar pulses right as their phase window opens.
        # =====================================================================
        total_time = max(1, current_time)
        c_explore = 0.32
        
        # 1. Graduated Dwell Cooldown (Anti-Camping)
        dwell_penalty = np.ones(self.num_bands, dtype=float)
        for b in range(self.num_bands):
            if self.last_scan_time[b] >= 0:
                dt_scan = current_time - self.last_scan_time[b]
                if dt_scan <= 1:
                    dwell_penalty[b] = 0.08  # Severe immediate cooling (92% penalty)
                elif dt_scan <= 2:
                    dwell_penalty[b] = 0.35  # Moderate cooling
                elif dt_scan <= 3:
                    dwell_penalty[b] = 0.65  # Slight cooling
                else:
                    dwell_penalty[b] = 1.00  # Fully recovered

        # 2. Hopping Transition Bounty:
        # If the last hit was an agile emitter, boost the predicted next hop
        hopping_bounty = np.zeros(self.num_bands, dtype=float)
        if self.last_hit_band >= 0 and self.last_hit_time[self.last_hit_band] >= current_time - 2:
            prev_b = self.last_hit_band
            tot_trans = np.sum(self.transition_counts[prev_b])
            if tot_trans >= 1:
                for target_b in range(self.num_bands):
                    if target_b != prev_b:
                        t_prob = self.transition_counts[prev_b][target_b] / tot_trans
                        hopping_bounty[target_b] = 0.35 * t_prob

        # 3. Periodic Phase Window Bounty:
        periodic_bounty = np.zeros(self.num_bands, dtype=float)
        for b in range(self.num_bands):
            if self.last_hit_time[b] >= 0:
                dt_h = current_time - self.last_hit_time[b]
                for p in [3, 4, 5, 6, 8]:
                    if dt_h > 0 and (dt_h % p == 0):
                        # Pulse window is firing right now!
                        periodic_bounty[b] = 0.40
                        break

        # 4. Multi-Objective Composite Utility
        utility_scores = np.zeros(self.num_bands, dtype=float)
        for b in range(self.num_bands):
            n_b = self.band_scans[b]
            dt_s = (current_time - self.last_scan_time[b]) if self.last_scan_time[b] >= 0 else 20
            
            # Exploration bonus with staleness reward
            exploration_bonus = c_explore * math.sqrt(math.log(total_time + 2) / (n_b + 1)) + min(0.25, dt_s * 0.015)
            
            # Base probability scaled by anti-camping cooldown
            effective_base = probs[b] * dwell_penalty[b]
            
            # Total decision score
            score = effective_base + hopping_bounty[b] + periodic_bounty[b] + exploration_bonus
            utility_scores[b] = score

        recommended_band = int(np.argmax(utility_scores))
        highest_prob_band = int(np.argmax(probs))

        meta = {
            "model_fitted": self.is_fitted,
            "model_type": "LogisticRegression" if (self.model_type == "lr" and self.lr_model) else "RandomForest",
            "training_samples": self.training_samples_count,
            "highest_prob_band": highest_prob_band,
            "max_probability": round(float(probs[highest_prob_band]), 4),
            "recommended_band": recommended_band,
            "utility_score": round(float(utility_scores[recommended_band]), 4),
            "hopping_target": int(np.argmax(hopping_bounty)) if np.max(hopping_bounty) > 0 else -1
        }

        rounded_probs = [round(float(p), 4) for p in probs]
        return rounded_probs, recommended_band, meta
