package com.ew.simulation.scheduler;

import com.ew.simulation.model.ScanResult;
import java.util.List;

public interface ScanScheduler {
    /**
     * Determines which frequency band to scan next.
     *
     * @param currentTime Current simulation time step
     * @param history History of recent scan results
     * @param numBands Total number of frequency bands
     * @return Selected band index (0 to numBands - 1)
     */
    int selectNextBand(long currentTime, List<ScanResult> history, int numBands);

    String getStrategyName();
}
