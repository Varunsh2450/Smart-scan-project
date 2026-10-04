package com.ew.simulation.scheduler;

import com.ew.simulation.model.ScanResult;
import org.springframework.stereotype.Component;

import java.util.List;

@Component("sequentialScheduler")
public class SequentialScheduler implements ScanScheduler {

    @Override
    public int selectNextBand(long currentTime, List<ScanResult> history, int numBands) {
        if (numBands <= 0) return 0;
        return (int) (currentTime % numBands);
    }

    @Override
    public String getStrategyName() {
        return "SEQUENTIAL";
    }
}
