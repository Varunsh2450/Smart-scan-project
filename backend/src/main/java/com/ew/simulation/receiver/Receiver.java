package com.ew.simulation.receiver;

import com.ew.simulation.model.EnvironmentState;
import com.ew.simulation.model.ScanResult;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Random;

@Component
public class Receiver {

    // Realistic Electronic Warfare RF Receiver Parameters
    // In real radar/EW receivers, detection is stochastic due to SNR, atmospheric fading, and thermal noise
    private double probabilityOfDetection = 0.88; // 88% detection probability when signal is physically present
    private double probabilityOfFalseAlarm = 0.02; // 2% false alarm rate from noise floor fluctuations
    private final Random random = new Random();

    /**
     * Scans a specific frequency band at the given environment state with realistic RF physics.
     * Only one band can be scanned per time step.
     *
     * @param bandNumber Target frequency band to tune into
     * @param env Ground truth RF environment state
     * @param strategy Strategy name (e.g. "SMART_ML", "SEQUENTIAL", "RANDOM")
     * @return ScanResult with hit=1 or miss=0
     */
    public ScanResult scan(int bandNumber, EnvironmentState env, String strategy) {
        long startTimeNs = System.nanoTime();
        boolean signalPresent = env.isSignalPresent(bandNumber);

        // Realistic stochastic RF detection model
        boolean hit;
        if (signalPresent) {
            // Signal present: detected if SNR exceeds threshold (Pd = 88%)
            hit = random.nextDouble() < probabilityOfDetection;
        } else {
            // No signal: false alarm if thermal noise spike exceeds threshold (Pfa = 2%)
            hit = random.nextDouble() < probabilityOfFalseAlarm;
        }

        ScanResult result = new ScanResult(env.getTime(), bandNumber, hit, strategy);
        if (hit) {
            if (signalPresent && env.getActiveEmitterNames() != null) {
                List<String> emitters = env.getActiveEmitterNames().get(bandNumber);
                if (emitters != null) {
                    result.setDetectedEmitters(new ArrayList<>(emitters));
                }
            } else if (!signalPresent) {
                List<String> noiseTag = new ArrayList<>();
                noiseTag.add("Thermal Noise False Alarm");
                result.setDetectedEmitters(noiseTag);
            }
        }
        result.setExecutionTimeNs(System.nanoTime() - startTimeNs);
        return result;
    }

    public double getProbabilityOfDetection() {
        return probabilityOfDetection;
    }

    public void setProbabilityOfDetection(double probabilityOfDetection) {
        this.probabilityOfDetection = Math.max(0.1, Math.min(1.0, probabilityOfDetection));
    }

    public double getProbabilityOfFalseAlarm() {
        return probabilityOfFalseAlarm;
    }

    public void setProbabilityOfFalseAlarm(double probabilityOfFalseAlarm) {
        this.probabilityOfFalseAlarm = Math.max(0.0, Math.min(0.2, probabilityOfFalseAlarm));
    }
}
