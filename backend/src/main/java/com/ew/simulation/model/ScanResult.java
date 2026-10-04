package com.ew.simulation.model;

import java.util.ArrayList;
import java.util.List;

public class ScanResult {
    private long time;
    private int band;
    private int result; // 1 = HIT, 0 = MISS
    private boolean hit;
    private String strategy;
    private List<String> detectedEmitters = new ArrayList<>();
    private List<Double> predictedProbabilities;
    private long executionTimeNs;

    public ScanResult() {}

    public ScanResult(long time, int band, boolean hit, String strategy) {
        this.time = time;
        this.band = band;
        this.hit = hit;
        this.result = hit ? 1 : 0;
        this.strategy = strategy;
    }

    public long getTime() { return time; }
    public void setTime(long time) { this.time = time; }

    public int getBand() { return band; }
    public void setBand(int band) { this.band = band; }

    public int getResult() { return result; }
    public void setResult(int result) {
        this.result = result;
        this.hit = (result == 1);
    }

    public boolean isHit() { return hit; }
    public void setHit(boolean hit) {
        this.hit = hit;
        this.result = hit ? 1 : 0;
    }

    public String getStrategy() { return strategy; }
    public void setStrategy(String strategy) { this.strategy = strategy; }

    public List<String> getDetectedEmitters() { return detectedEmitters; }
    public void setDetectedEmitters(List<String> detectedEmitters) { this.detectedEmitters = detectedEmitters; }

    public List<Double> getPredictedProbabilities() { return predictedProbabilities; }
    public void setPredictedProbabilities(List<Double> predictedProbabilities) { this.predictedProbabilities = predictedProbabilities; }

    public long getExecutionTimeNs() { return executionTimeNs; }
    public void setExecutionTimeNs(long executionTimeNs) { this.executionTimeNs = executionTimeNs; }
}
