package com.ew.simulation.scheduler;

import com.ew.simulation.model.ScanResult;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.util.*;

@Component("smartMlScheduler")
public class SmartMlScheduler implements ScanScheduler {

    private static final Logger log = LoggerFactory.getLogger(SmartMlScheduler.class);

    private final RestTemplate restTemplate;
    private final String mlServiceUrl;
    private final Random random = new Random();

    private volatile List<Double> latestProbabilities = new ArrayList<>();
    private volatile int lastSelectedBand = 0;
    private volatile boolean mlServiceConnected = false;
    private volatile String lastModelType = "RandomForest";

    public SmartMlScheduler(RestTemplate restTemplate,
                             @Value("${ew.ml-service.url:http://localhost:5000}") String mlServiceUrl) {
        this.restTemplate = restTemplate;
        this.mlServiceUrl = mlServiceUrl;
    }

    @Override
    public int selectNextBand(long currentTime, List<ScanResult> history, int numBands) {
        if (numBands <= 0) return 0;

        // Try calling Python ML Service
        try {
            Map<String, Object> requestBody = new HashMap<>();
            
            // Format recent history (up to last 150 scans for fast response)
            List<Map<String, Object>> historyPayload = new ArrayList<>();
            int startIndex = Math.max(0, history.size() - 150);
            for (int i = startIndex; i < history.size(); i++) {
                ScanResult res = history.get(i);
                Map<String, Object> item = new HashMap<>();
                item.put("band", res.getBand());
                item.put("result", res.getResult());
                item.put("time", res.getTime());
                historyPayload.add(item);
            }

            requestBody.put("history", historyPayload);
            requestBody.put("current_time", currentTime);
            requestBody.put("num_bands", numBands);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(requestBody, headers);

            ResponseEntity<Map> response = restTemplate.postForEntity(
                    mlServiceUrl + "/predict",
                    entity,
                    Map.class
            );

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                Map body = response.getBody();
                List<Double> probs = (List<Double>) body.get("probabilities");
                Number recBand = (Number) body.get("recommended_band");
                
                if (probs != null) {
                    this.latestProbabilities = new ArrayList<>(probs);
                }
                
                Map meta = (Map) body.get("metadata");
                if (meta != null && meta.containsKey("model_type")) {
                    this.lastModelType = (String) meta.get("model_type");
                }

                this.mlServiceConnected = true;

                if (recBand != null) {
                    this.lastSelectedBand = recBand.intValue();
                    return this.lastSelectedBand;
                }
            }
        } catch (Exception e) {
            this.mlServiceConnected = false;
            log.debug("Python ML service unavailable at {}, using local fallback: {}", mlServiceUrl, e.getMessage());
        }

        // Local UCB Fallback if ML service is unreachable or bootstrapping
        this.lastSelectedBand = fallbackUcbSelect(currentTime, history, numBands);
        return this.lastSelectedBand;
    }

    /**
     * Local Upper Confidence Bound (UCB1) multi-armed bandit fallback.
     */
    private int fallbackUcbSelect(long currentTime, List<ScanResult> history, int numBands) {
        int[] bandScans = new int[numBands];
        int[] bandHits = new int[numBands];
        int lastHitBand = -1;

        for (ScanResult res : history) {
            int b = res.getBand();
            if (b >= 0 && b < numBands) {
                bandScans[b]++;
                if (res.isHit()) {
                    bandHits[b]++;
                    lastHitBand = b;
                }
            }
        }

        // Unvisited bands take top priority
        for (int b = 0; b < numBands; b++) {
            if (bandScans[b] == 0) {
                updateDummyProbabilities(numBands, b);
                return b;
            }
        }

        double maxScore = -1.0;
        int bestBand = 0;
        double explorationC = 0.25;
        double logTotal = Math.log(Math.max(1, currentTime) + 1.0);
        List<Double> scores = new ArrayList<>(numBands);

        for (int b = 0; b < numBands; b++) {
            double p = (bandHits[b] + 0.5) / (bandScans[b] + 2.0);
            // Apply anti-camping penalty if scanned on the immediate prior step
            if (b == lastSelectedBand) {
                p *= 0.40;
            }
            double bonus = explorationC * Math.sqrt(logTotal / (bandScans[b] + 1));
            double score = p + bonus;
            scores.add(Math.min(0.99, score));
            if (score > maxScore) {
                maxScore = score;
                bestBand = b;
            }
        }

        this.latestProbabilities = scores;
        return bestBand;
    }

    private void updateDummyProbabilities(int numBands, int highlightBand) {
        List<Double> dummy = new ArrayList<>(numBands);
        for (int i = 0; i < numBands; i++) {
            dummy.add(i == highlightBand ? 0.8 : 0.05);
        }
        this.latestProbabilities = dummy;
    }

    @Override
    public String getStrategyName() {
        return "SMART_ML";
    }

    public List<Double> getLatestProbabilities() {
        return latestProbabilities;
    }

    public int getLastSelectedBand() {
        return lastSelectedBand;
    }

    public boolean isMlServiceConnected() {
        return mlServiceConnected;
    }

    public String getLastModelType() {
        return lastModelType;
    }
}
