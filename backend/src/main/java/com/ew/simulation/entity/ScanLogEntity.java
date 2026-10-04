package com.ew.simulation.entity;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "scan_logs", indexes = {
    @Index(name = "idx_strategy_time", columnList = "strategy, timeStep")
})
public class ScanLogEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private long timeStep;

    @Column(nullable = false)
    private int scannedBand;

    @Column(nullable = false)
    private int result; // 1 = HIT, 0 = MISS

    @Column(nullable = false, length = 32)
    private String strategy;

    @Column(length = 256)
    private String detectedEmitters;

    @Column(nullable = false)
    private Instant createdAt = Instant.now();

    public ScanLogEntity() {}

    public ScanLogEntity(long timeStep, int scannedBand, int result, String strategy, String detectedEmitters) {
        this.timeStep = timeStep;
        this.scannedBand = scannedBand;
        this.result = result;
        this.strategy = strategy;
        this.detectedEmitters = detectedEmitters;
        this.createdAt = Instant.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public long getTimeStep() { return timeStep; }
    public void setTimeStep(long timeStep) { this.timeStep = timeStep; }

    public int getScannedBand() { return scannedBand; }
    public void setScannedBand(int scannedBand) { this.scannedBand = scannedBand; }

    public int getResult() { return result; }
    public void setResult(int result) { this.result = result; }

    public String getStrategy() { return strategy; }
    public void setStrategy(String strategy) { this.strategy = strategy; }

    public String getDetectedEmitters() { return detectedEmitters; }
    public void setDetectedEmitters(String detectedEmitters) { this.detectedEmitters = detectedEmitters; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
