package com.ew.simulation.model;

import java.util.ArrayList;
import java.util.List;

public class SimulationStats {
    private String strategy;
    private long totalScans;
    private long hits;
    private long misses;
    private double detectionRate; // hits / totalScans
    private double missRate;      // misses / totalScans
    private double avgInterceptTime; // average time steps to intercept
    private List<Double> rollingDetectionRate = new ArrayList<>();
    private List<Long> cumulativeHitsHistory = new ArrayList<>();

    public SimulationStats() {}

    public SimulationStats(String strategy) {
        this.strategy = strategy;
    }

    public synchronized void recordScan(boolean hit, long interceptDelay) {
        this.totalScans++;
        if (hit) {
            this.hits++;
        } else {
            this.misses++;
        }
        this.detectionRate = totalScans > 0 ? (double) hits / totalScans : 0.0;
        this.missRate = totalScans > 0 ? (double) misses / totalScans : 0.0;

        if (hit && interceptDelay > 0) {
            if (avgInterceptTime == 0.0) {
                avgInterceptTime = (double) interceptDelay;
            } else {
                // Exponential moving average for intercept delay
                avgInterceptTime = 0.9 * avgInterceptTime + 0.1 * interceptDelay;
            }
        }

        // Store rolling detection rate sample (keep up to 100 points)
        if (rollingDetectionRate.size() >= 100) {
            rollingDetectionRate.remove(0);
        }
        rollingDetectionRate.add(Math.round(this.detectionRate * 1000.0) / 10.0);

        if (cumulativeHitsHistory.size() >= 100) {
            cumulativeHitsHistory.remove(0);
        }
        cumulativeHitsHistory.add(this.hits);
    }

    public synchronized void reset() {
        this.totalScans = 0;
        this.hits = 0;
        this.misses = 0;
        this.detectionRate = 0.0;
        this.missRate = 0.0;
        this.avgInterceptTime = 0.0;
        this.rollingDetectionRate.clear();
        this.cumulativeHitsHistory.clear();
    }

    // Getters and Setters
    public String getStrategy() { return strategy; }
    public void setStrategy(String strategy) { this.strategy = strategy; }

    public long getTotalScans() { return totalScans; }
    public void setTotalScans(long totalScans) { this.totalScans = totalScans; }

    public long getHits() { return hits; }
    public void setHits(long hits) { this.hits = hits; }

    public long getMisses() { return misses; }
    public void setMisses(long misses) { this.misses = misses; }

    public double getDetectionRate() { return detectionRate; }
    public void setDetectionRate(double detectionRate) { this.detectionRate = detectionRate; }

    public double getMissRate() { return missRate; }
    public void setMissRate(double missRate) { this.missRate = missRate; }

    public double getAvgInterceptTime() { return avgInterceptTime; }
    public void setAvgInterceptTime(double avgInterceptTime) { this.avgInterceptTime = avgInterceptTime; }

    public List<Double> getRollingDetectionRate() { return rollingDetectionRate; }
    public void setRollingDetectionRate(List<Double> rollingDetectionRate) { this.rollingDetectionRate = rollingDetectionRate; }

    public List<Long> getCumulativeHitsHistory() { return cumulativeHitsHistory; }
    public void setCumulativeHitsHistory(List<Long> cumulativeHitsHistory) { this.cumulativeHitsHistory = cumulativeHitsHistory; }
}
