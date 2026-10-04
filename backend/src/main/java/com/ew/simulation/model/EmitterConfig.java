package com.ew.simulation.model;

import java.util.*;

public class EmitterConfig {
    private String id;
    private String name;
    private EmitterType type;
    private int primaryBand;
    private int period; // For PERIODIC signals
    private int duration; // Active duration per period
    private int phaseOffset; // Phase offset
    private double burstProbability; // For RANDOM_BURST
    private int burstDuration;
    private List<Integer> hoppingSequence; // For FREQUENCY_HOPPING
    private int dwellTime; // Steps to dwell on each hopped band

    // Transient runtime state for burst emitter
    private transient long burstEndStep = -1;
    private transient final Random rng = new Random();

    public EmitterConfig() {
        this.hoppingSequence = new ArrayList<>();
    }

    public EmitterConfig(String id, String name, EmitterType type, int primaryBand) {
        this.id = id;
        this.name = name;
        this.type = type;
        this.primaryBand = primaryBand;
        this.hoppingSequence = new ArrayList<>();
    }

    public static EmitterConfig createFixed(String id, String name, int band) {
        EmitterConfig e = new EmitterConfig(id, name, EmitterType.FIXED, band);
        return e;
    }

    public static EmitterConfig createPeriodic(String id, String name, int band, int period, int duration, int phaseOffset) {
        EmitterConfig e = new EmitterConfig(id, name, EmitterType.PERIODIC, band);
        e.setPeriod(period);
        e.setDuration(duration);
        e.setPhaseOffset(phaseOffset);
        return e;
    }

    public static EmitterConfig createRandomBurst(String id, String name, int band, double burstProbability, int burstDuration) {
        EmitterConfig e = new EmitterConfig(id, name, EmitterType.RANDOM_BURST, band);
        e.setBurstProbability(burstProbability);
        e.setBurstDuration(burstDuration);
        return e;
    }

    public static EmitterConfig createFrequencyHopper(String id, String name, List<Integer> hoppingSequence, int dwellTime) {
        EmitterConfig e = new EmitterConfig(id, name, EmitterType.FREQUENCY_HOPPING, hoppingSequence.isEmpty() ? 0 : hoppingSequence.get(0));
        e.setHoppingSequence(hoppingSequence);
        e.setDwellTime(Math.max(1, dwellTime));
        return e;
    }

    /**
     * Checks if this emitter is actively transmitting at timeStep, and returns list of bands occupied.
     */
    public List<Integer> getActiveBandsAt(long timeStep) {
        List<Integer> activeBands = new ArrayList<>();
        switch (type) {
            case FIXED:
                activeBands.add(primaryBand);
                break;

            case PERIODIC:
                if (period > 0) {
                    long cyclePos = (timeStep + phaseOffset) % period;
                    if (cyclePos < duration) {
                        activeBands.add(primaryBand);
                    }
                }
                break;

            case RANDOM_BURST:
                if (timeStep < burstEndStep) {
                    activeBands.add(primaryBand);
                } else if (rng.nextDouble() < burstProbability) {
                    burstEndStep = timeStep + Math.max(1, burstDuration);
                    activeBands.add(primaryBand);
                }
                break;

            case FREQUENCY_HOPPING:
                if (hoppingSequence != null && !hoppingSequence.isEmpty()) {
                    int dwell = Math.max(1, dwellTime);
                    int hopIndex = (int) ((timeStep / dwell) % hoppingSequence.size());
                    activeBands.add(hoppingSequence.get(hopIndex));
                }
                break;
        }
        return activeBands;
    }

    public void resetRuntimeState() {
        this.burstEndStep = -1;
    }

    // Getters and Setters
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public EmitterType getType() { return type; }
    public void setType(EmitterType type) { this.type = type; }

    public int getPrimaryBand() { return primaryBand; }
    public void setPrimaryBand(int primaryBand) { this.primaryBand = primaryBand; }

    public int getPeriod() { return period; }
    public void setPeriod(int period) { this.period = period; }

    public int getDuration() { return duration; }
    public void setDuration(int duration) { this.duration = duration; }

    public int getPhaseOffset() { return phaseOffset; }
    public void setPhaseOffset(int phaseOffset) { this.phaseOffset = phaseOffset; }

    public double getBurstProbability() { return burstProbability; }
    public void setBurstProbability(double burstProbability) { this.burstProbability = burstProbability; }

    public int getBurstDuration() { return burstDuration; }
    public void setBurstDuration(int burstDuration) { this.burstDuration = burstDuration; }

    public List<Integer> getHoppingSequence() { return hoppingSequence; }
    public void setHoppingSequence(List<Integer> hoppingSequence) { this.hoppingSequence = hoppingSequence; }

    public int getDwellTime() { return dwellTime; }
    public void setDwellTime(int dwellTime) { this.dwellTime = dwellTime; }
}
