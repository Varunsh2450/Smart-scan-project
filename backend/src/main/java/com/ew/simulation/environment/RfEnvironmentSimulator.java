package com.ew.simulation.environment;

import com.ew.simulation.model.EmitterConfig;
import com.ew.simulation.model.EmitterType;
import com.ew.simulation.model.EnvironmentState;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

@Component
public class RfEnvironmentSimulator {

    private int numBands;
    private final List<EmitterConfig> emitters = new CopyOnWriteArrayList<>();
    // Tracks the step when an emitter last became active on a band (for intercept delay calculation)
    private final Map<Integer, Long> bandOnsetStep = new ConcurrentHashMap<>();
    private final Random random = new Random();
    private double noiseFloorProbability = 0.0; // optional false-alarm rate

    public RfEnvironmentSimulator(@Value("${ew.simulation.default-bands:20}") int numBands) {
        this.numBands = numBands;
        loadDefaultScenario();
    }

    public synchronized void loadDefaultScenario() {
        emitters.clear();
        bandOnsetStep.clear();

        // 1. Primary Agile Frequency Hopper (hops across bands [1, 5, 9, 14, 18])
        emitters.add(EmitterConfig.createFrequencyHopper("EMIT-HOP-1", "Agile EW Jammer Hopper",
                Arrays.asList(1, 5, 9, 14, 18), 2));

        // 2. Secondary Fast Frequency Hopper (hops across bands [2, 6, 11, 15, 19])
        emitters.add(EmitterConfig.createFrequencyHopper("EMIT-HOP-2", "Fast Tactical Hopper",
                Arrays.asList(2, 6, 11, 15, 19), 1));

        // 3. Periodic Search Radar on band 3 (Period 4, Active duration 1, Phase 0)
        emitters.add(EmitterConfig.createPeriodic("EMIT-PER-1", "Pulse Radar Alpha (P=4)", 3, 4, 1, 0));

        // 4. Periodic Surveillance Radar on band 12 (Period 5, Active duration 1, Phase 2)
        emitters.add(EmitterConfig.createPeriodic("EMIT-PER-2", "Surveillance Radar (P=5)", 12, 5, 1, 2));

        // 5. Intermittent Burst Radio on band 16 (Probability 0.35, duration 2)
        emitters.add(EmitterConfig.createRandomBurst("EMIT-BURST-1", "Tactical Burst Radio", 16, 0.35, 2));

        // 6. Tactical Link on band 7 (Burst rate 0.40, duration 2)
        emitters.add(EmitterConfig.createRandomBurst("EMIT-BURST-2", "Tactical Link Beacon", 7, 0.40, 2));
    }

    /**
     * User interactive injection of a signal burst on any band.
     */
    public synchronized void injectBurst(int band, int duration) {
        if (band >= 0 && band < numBands) {
            emitters.add(EmitterConfig.createRandomBurst(
                "USER-INJECT-" + System.currentTimeMillis(),
                "Injected Burst (Band " + band + ")",
                band,
                1.0,
                Math.max(1, duration)
            ));
        }
    }

    public synchronized void loadAgileHopperScenario() {
        emitters.clear();
        bandOnsetStep.clear();

        emitters.add(EmitterConfig.createFixed("EMIT-FIXED-1", "Command Link", 4));
        emitters.add(EmitterConfig.createFrequencyHopper("EMIT-HOP-1", "Fast Hopper Alpha",
                Arrays.asList(2, 6, 11, 15, 19), 1));
        emitters.add(EmitterConfig.createFrequencyHopper("EMIT-HOP-2", "Fast Hopper Bravo",
                Arrays.asList(8, 13, 3, 17, 0), 2));
        emitters.add(EmitterConfig.createRandomBurst("EMIT-BURST-1", "Burst Radar", 10, 0.35, 3));
    }

    public synchronized void loadStealthScenario() {
        emitters.clear();
        bandOnsetStep.clear();

        emitters.add(EmitterConfig.createPeriodic("EMIT-PER-1", "LPI Stealth Radar", 2, 8, 1, 3));
        emitters.add(EmitterConfig.createPeriodic("EMIT-PER-2", "Stealth Beacon", 15, 10, 1, 0));
        emitters.add(EmitterConfig.createRandomBurst("EMIT-BURST-1", "Occasional Burst", 8, 0.10, 1));
        emitters.add(EmitterConfig.createRandomBurst("EMIT-BURST-2", "Short Tactical Link", 13, 0.15, 2));
    }

    /**
     * Generates the ground truth RF spectrum state for timeStep t.
     */
    public synchronized EnvironmentState generateGroundTruth(long timeStep) {
        int[] bands = new int[numBands];
        Map<Integer, List<String>> activeEmitterNames = new HashMap<>();
        int totalActive = 0;

        for (EmitterConfig emitter : emitters) {
            List<Integer> activeBands = emitter.getActiveBandsAt(timeStep);
            for (int b : activeBands) {
                if (b >= 0 && b < numBands) {
                    if (bands[b] == 0) {
                        bands[b] = 1;
                        totalActive++;
                        // Record onset step if previously inactive
                        bandOnsetStep.putIfAbsent(b, timeStep);
                    }
                    activeEmitterNames.computeIfAbsent(b, k -> new ArrayList<>()).add(emitter.getName());
                }
            }
        }

        // Ambient noise / false alarms
        if (noiseFloorProbability > 0.0) {
            for (int b = 0; b < numBands; b++) {
                if (bands[b] == 0 && random.nextDouble() < noiseFloorProbability) {
                    bands[b] = 1;
                    totalActive++;
                    activeEmitterNames.computeIfAbsent(b, k -> new ArrayList<>()).add("Noise Floor Anomaly");
                }
            }
        }

        // Clean up onset tracking for bands that became silent
        for (int b = 0; b < numBands; b++) {
            if (bands[b] == 0) {
                bandOnsetStep.remove(b);
            }
        }

        return new EnvironmentState(timeStep, bands, activeEmitterNames, totalActive);
    }

    public long getOnsetStep(int band) {
        return bandOnsetStep.getOrDefault(band, -1L);
    }

    public synchronized void reset() {
        bandOnsetStep.clear();
        for (EmitterConfig e : emitters) {
            e.resetRuntimeState();
        }
    }

    public int getNumBands() { return numBands; }
    public synchronized void setNumBands(int numBands) {
        this.numBands = Math.max(5, Math.min(100, numBands));
    }

    public List<EmitterConfig> getEmitters() { return emitters; }

    public synchronized void addEmitter(EmitterConfig emitter) {
        this.emitters.add(emitter);
    }

    public synchronized boolean removeEmitter(String emitterId) {
        return this.emitters.removeIf(e -> e.getId().equals(emitterId));
    }

    public double getNoiseFloorProbability() { return noiseFloorProbability; }
    public void setNoiseFloorProbability(double noiseFloorProbability) {
        this.noiseFloorProbability = noiseFloorProbability;
    }
}
