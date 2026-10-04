package com.ew.simulation.model;

import java.util.List;
import java.util.Map;

public class EnvironmentState {
    private long time;
    private int[] bands; // 1 = signal present, 0 = no signal
    private Map<Integer, List<String>> activeEmitterNames; // band -> emitter names
    private int totalActiveSignals;

    public EnvironmentState() {}

    public EnvironmentState(long time, int[] bands, Map<Integer, List<String>> activeEmitterNames, int totalActiveSignals) {
        this.time = time;
        this.bands = bands;
        this.activeEmitterNames = activeEmitterNames;
        this.totalActiveSignals = totalActiveSignals;
    }

    public long getTime() { return time; }
    public void setTime(long time) { this.time = time; }

    public int[] getBands() { return bands; }
    public void setBands(int[] bands) { this.bands = bands; }

    public Map<Integer, List<String>> getActiveEmitterNames() { return activeEmitterNames; }
    public void setActiveEmitterNames(Map<Integer, List<String>> activeEmitterNames) { this.activeEmitterNames = activeEmitterNames; }

    public int getTotalActiveSignals() { return totalActiveSignals; }
    public void setTotalActiveSignals(int totalActiveSignals) { this.totalActiveSignals = totalActiveSignals; }

    public boolean isSignalPresent(int band) {
        if (bands != null && band >= 0 && band < bands.length) {
            return bands[band] == 1;
        }
        return false;
    }
}
