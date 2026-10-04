package com.ew.simulation.service;

import com.ew.simulation.entity.ScanLogEntity;
import com.ew.simulation.environment.RfEnvironmentSimulator;
import com.ew.simulation.model.EnvironmentState;
import com.ew.simulation.model.ScanResult;
import com.ew.simulation.model.SimulationStats;
import com.ew.simulation.receiver.Receiver;
import com.ew.simulation.repository.ScanLogRepository;
import com.ew.simulation.scheduler.RandomScheduler;
import com.ew.simulation.scheduler.ScanScheduler;
import com.ew.simulation.scheduler.SequentialScheduler;
import com.ew.simulation.scheduler.SmartMlScheduler;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicLong;

@Service
public class SimulationEngine {

    private static final Logger log = LoggerFactory.getLogger(SimulationEngine.class);

    private final RfEnvironmentSimulator environmentSimulator;
    private final Receiver receiver;
    private final SmartMlScheduler smartMlScheduler;
    private final SequentialScheduler sequentialScheduler;
    private final RandomScheduler randomScheduler;
    private final ScanLogRepository scanLogRepository;

    private final AtomicLong currentTime = new AtomicLong(0);
    private final AtomicBoolean isRunning = new AtomicBoolean(false);

    private int tickIntervalMs;
    private ScheduledExecutorService executorService;
    private ScheduledFuture<?> simulationTask;

    // Distinct histories for each strategy
    private final List<ScanResult> smartMlHistory = new CopyOnWriteArrayList<>();
    private final List<ScanResult> sequentialHistory = new CopyOnWriteArrayList<>();
    private final List<ScanResult> randomHistory = new CopyOnWriteArrayList<>();

    // Real-time statistics per strategy
    private final SimulationStats smartMlStats = new SimulationStats("SMART_ML");
    private final SimulationStats sequentialStats = new SimulationStats("SEQUENTIAL");
    private final SimulationStats randomStats = new SimulationStats("RANDOM");

    // Most recent state for instant polling/UI updates
    private volatile EnvironmentState latestEnvironment;
    private volatile ScanResult latestSmartMlScan;
    private volatile ScanResult latestSequentialScan;
    private volatile ScanResult latestRandomScan;

    // Primary strategy to highlight in single-view
    private volatile String primaryStrategy = "SMART_ML";

    public SimulationEngine(RfEnvironmentSimulator environmentSimulator,
                            Receiver receiver,
                            SmartMlScheduler smartMlScheduler,
                            SequentialScheduler sequentialScheduler,
                            RandomScheduler randomScheduler,
                            ScanLogRepository scanLogRepository,
                            @Value("${ew.simulation.default-tick-ms:500}") int tickIntervalMs) {
        this.environmentSimulator = environmentSimulator;
        this.receiver = receiver;
        this.smartMlScheduler = smartMlScheduler;
        this.sequentialScheduler = sequentialScheduler;
        this.randomScheduler = randomScheduler;
        this.scanLogRepository = scanLogRepository;
        this.tickIntervalMs = tickIntervalMs;
    }

    @PostConstruct
    public void init() {
        this.executorService = Executors.newSingleThreadScheduledExecutor(r -> {
            Thread t = new Thread(r, "simulation-engine-thread");
            t.setDaemon(true);
            return t;
        });
        // Generate initial idle state
        this.latestEnvironment = environmentSimulator.generateGroundTruth(0);
    }

    @PreDestroy
    public void shutdown() {
        pause();
        if (executorService != null) {
            executorService.shutdownNow();
        }
    }

    public synchronized void start(Integer speedMs) {
        if (speedMs != null && speedMs > 0) {
            this.tickIntervalMs = Math.max(50, Math.min(5000, speedMs));
        }
        if (isRunning.compareAndSet(false, true)) {
            log.info("Starting EW simulation at interval {} ms", tickIntervalMs);
            if (simulationTask != null && !simulationTask.isDone()) {
                simulationTask.cancel(true);
            }
            simulationTask = executorService.scheduleAtFixedRate(
                    this::safeStep,
                    0,
                    tickIntervalMs,
                    TimeUnit.MILLISECONDS
            );
        }
    }

    public synchronized void pause() {
        if (isRunning.compareAndSet(true, false)) {
            log.info("Pausing EW simulation at step {}", currentTime.get());
            if (simulationTask != null) {
                simulationTask.cancel(false);
                simulationTask = null;
            }
        }
    }

    private void safeStep() {
        try {
            step();
        } catch (Exception e) {
            log.error("Error during simulation step: {}", e.getMessage(), e);
        }
    }

    /**
     * Executes a single discrete simulation step:
     * 1. Generates ground truth RF spectrum for current time
     * 2. Evaluates Smart ML, Sequential, and Random schedulers concurrently
     * 3. Scans bands and updates metrics & logs
     */
    public synchronized Map<String, Object> step() {
        long t = currentTime.getAndIncrement();
        int numBands = environmentSimulator.getNumBands();

        // 1. Generate RF Ground Truth
        EnvironmentState env = environmentSimulator.generateGroundTruth(t);
        this.latestEnvironment = env;

        // 2. Execute Smart ML Strategy
        int mlBand = smartMlScheduler.selectNextBand(t, smartMlHistory, numBands);
        ScanResult mlResult = receiver.scan(mlBand, env, "SMART_ML");
        mlResult.setPredictedProbabilities(smartMlScheduler.getLatestProbabilities());
        long mlOnset = environmentSimulator.getOnsetStep(mlBand);
        long mlDelay = (mlResult.isHit() && mlOnset >= 0) ? (t - mlOnset + 1) : 0;
        smartMlStats.recordScan(mlResult.isHit(), mlDelay);
        appendHistory(smartMlHistory, mlResult);
        this.latestSmartMlScan = mlResult;

        // 3. Execute Sequential Strategy
        int seqBand = sequentialScheduler.selectNextBand(t, sequentialHistory, numBands);
        ScanResult seqResult = receiver.scan(seqBand, env, "SEQUENTIAL");
        long seqOnset = environmentSimulator.getOnsetStep(seqBand);
        long seqDelay = (seqResult.isHit() && seqOnset >= 0) ? (t - seqOnset + 1) : 0;
        sequentialStats.recordScan(seqResult.isHit(), seqDelay);
        appendHistory(sequentialHistory, seqResult);
        this.latestSequentialScan = seqResult;

        // 4. Execute Random Strategy
        int randBand = randomScheduler.selectNextBand(t, randomHistory, numBands);
        ScanResult randResult = receiver.scan(randBand, env, "RANDOM");
        long randOnset = environmentSimulator.getOnsetStep(randBand);
        long randDelay = (randResult.isHit() && randOnset >= 0) ? (t - randOnset + 1) : 0;
        randomStats.recordScan(randResult.isHit(), randDelay);
        appendHistory(randomHistory, randResult);
        this.latestRandomScan = randResult;

        // 5. Asynchronously persist primary scan log to H2
        ScanResult primaryScan = getPrimaryScan();
        try {
            String emitterSummary = (primaryScan.getDetectedEmitters() != null && !primaryScan.getDetectedEmitters().isEmpty())
                    ? String.join(", ", primaryScan.getDetectedEmitters()) : "None";
            scanLogRepository.save(new ScanLogEntity(
                    t,
                    primaryScan.getBand(),
                    primaryScan.getResult(),
                    primaryScan.getStrategy(),
                    emitterSummary
            ));
        } catch (Exception e) {
            log.debug("Error saving log to H2: {}", e.getMessage());
        }

        return getStateSnapshot();
    }

    private void appendHistory(List<ScanResult> history, ScanResult result) {
        history.add(result);
        if (history.size() > 500) {
            history.remove(0);
        }
    }

    public synchronized void reset() {
        boolean wasRunning = isRunning.get();
        if (wasRunning) {
            pause();
        }
        currentTime.set(0);
        smartMlHistory.clear();
        sequentialHistory.clear();
        randomHistory.clear();
        smartMlStats.reset();
        sequentialStats.reset();
        randomStats.reset();
        environmentSimulator.reset();
        this.latestEnvironment = environmentSimulator.generateGroundTruth(0);
        this.latestSmartMlScan = null;
        this.latestSequentialScan = null;
        this.latestRandomScan = null;

        try {
            scanLogRepository.deleteAll();
        } catch (Exception ignored) {}

        log.info("EW Simulation reset successfully.");
        if (wasRunning) {
            start(tickIntervalMs);
        }
    }

    public ScanResult getPrimaryScan() {
        if ("SEQUENTIAL".equalsIgnoreCase(primaryStrategy)) {
            return latestSequentialScan != null ? latestSequentialScan : new ScanResult(currentTime.get(), 0, false, "SEQUENTIAL");
        } else if ("RANDOM".equalsIgnoreCase(primaryStrategy)) {
            return latestRandomScan != null ? latestRandomScan : new ScanResult(currentTime.get(), 0, false, "RANDOM");
        }
        return latestSmartMlScan != null ? latestSmartMlScan : new ScanResult(currentTime.get(), 0, false, "SMART_ML");
    }

    public Map<String, Object> getStateSnapshot() {
        Map<String, Object> state = new HashMap<>();
        state.put("time", currentTime.get());
        state.put("running", isRunning.get());
        state.put("tickIntervalMs", tickIntervalMs);
        state.put("primaryStrategy", primaryStrategy);
        state.put("numBands", environmentSimulator.getNumBands());

        if (latestEnvironment != null) {
            state.put("bands", latestEnvironment.getBands());
            state.put("activeEmitters", latestEnvironment.getActiveEmitterNames());
            state.put("totalActiveSignals", latestEnvironment.getTotalActiveSignals());
        }

        ScanResult primaryScan = getPrimaryScan();
        state.put("scannedBand", primaryScan.getBand());
        state.put("hit", primaryScan.isHit());
        state.put("result", primaryScan.getResult());
        state.put("detectedEmitters", primaryScan.getDetectedEmitters());
        state.put("probabilities", smartMlScheduler.getLatestProbabilities());
        state.put("mlConnected", smartMlScheduler.isMlServiceConnected());
        state.put("mlModelType", smartMlScheduler.getLastModelType());

        // Comparison stats
        Map<String, Object> comparison = new HashMap<>();
        comparison.put("smart_ml", smartMlStats);
        comparison.put("sequential", sequentialStats);
        comparison.put("random", randomStats);
        state.put("comparison", comparison);

        // Stats for current primary strategy
        SimulationStats activeStats = getStatsForStrategy(primaryStrategy);
        state.put("detectionRate", activeStats.getDetectionRate());
        state.put("missRate", activeStats.getMissRate());
        state.put("avgInterceptTime", activeStats.getAvgInterceptTime());
        state.put("totalScans", activeStats.getTotalScans());
        state.put("hits", activeStats.getHits());
        state.put("misses", activeStats.getMisses());

        return state;
    }

    public SimulationStats getStatsForStrategy(String strategy) {
        if ("SEQUENTIAL".equalsIgnoreCase(strategy)) return sequentialStats;
        if ("RANDOM".equalsIgnoreCase(strategy)) return randomStats;
        return smartMlStats;
    }

    public void setTickIntervalMs(int tickIntervalMs) {
        this.tickIntervalMs = Math.max(50, Math.min(5000, tickIntervalMs));
        if (isRunning.get()) {
            pause();
            start(this.tickIntervalMs);
        }
    }

    public void setPrimaryStrategy(String primaryStrategy) {
        this.primaryStrategy = primaryStrategy;
    }

    public boolean isRunning() {
        return isRunning.get();
    }

    public long getCurrentTime() {
        return currentTime.get();
    }

    public RfEnvironmentSimulator getEnvironmentSimulator() {
        return environmentSimulator;
    }

    public SimulationStats getSmartMlStats() {
        return smartMlStats;
    }

    public SimulationStats getSequentialStats() {
        return sequentialStats;
    }

    public SimulationStats getRandomStats() {
        return randomStats;
    }

    public List<ScanResult> getSmartMlHistory() {
        return smartMlHistory;
    }
}
