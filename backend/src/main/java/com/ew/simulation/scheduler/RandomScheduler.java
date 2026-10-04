package com.ew.simulation.scheduler;

import com.ew.simulation.model.ScanResult;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Random;

@Component("randomScheduler")
public class RandomScheduler implements ScanScheduler {

    private final Random random = new Random();

    @Override
    public int selectNextBand(long currentTime, List<ScanResult> history, int numBands) {
        if (numBands <= 0) return 0;
        return random.nextInt(numBands);
    }

    @Override
    public String getStrategyName() {
        return "RANDOM";
    }
}
