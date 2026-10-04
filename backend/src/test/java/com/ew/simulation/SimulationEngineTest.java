package com.ew.simulation;

import com.ew.simulation.entity.ScanLogEntity;
import com.ew.simulation.environment.RfEnvironmentSimulator;
import com.ew.simulation.model.EnvironmentState;
import com.ew.simulation.model.ScanResult;
import com.ew.simulation.model.SimulationStats;
import com.ew.simulation.receiver.Receiver;
import com.ew.simulation.repository.ScanLogRepository;
import com.ew.simulation.scheduler.RandomScheduler;
import com.ew.simulation.scheduler.SequentialScheduler;
import com.ew.simulation.scheduler.SmartMlScheduler;
import com.ew.simulation.service.SimulationEngine;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Example;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.repository.query.FluentQuery;
import org.springframework.web.client.RestTemplate;

import java.util.*;
import java.util.function.Function;

import static org.junit.jupiter.api.Assertions.*;

public class SimulationEngineTest {

    private RfEnvironmentSimulator environmentSimulator;
    private Receiver receiver;
    private SmartMlScheduler smartMlScheduler;
    private SequentialScheduler sequentialScheduler;
    private RandomScheduler randomScheduler;
    private SimulationEngine simulationEngine;

    // Lightweight in-memory stub for ScanLogRepository
    private final ScanLogRepository stubRepository = new ScanLogRepository() {
        private final List<ScanLogEntity> logs = new ArrayList<>();

        @Override
        public <S extends ScanLogEntity> S save(S entity) {
            logs.add(entity);
            return entity;
        }

        @Override
        public List<ScanLogEntity> findTop100ByStrategyOrderByTimeStepDesc(String strategy) {
            return Collections.emptyList();
        }

        @Override
        public long countByStrategy(String strategy) {
            return logs.stream().filter(l -> strategy.equals(l.getStrategy())).count();
        }

        @Override
        public long countByStrategyAndResult(String strategy, int result) {
            return logs.stream().filter(l -> strategy.equals(l.getStrategy()) && l.getResult() == result).count();
        }

        @Override
        public List<ScanLogEntity> findRecentLogsByStrategy(String strategy, Pageable pageable) {
            return Collections.emptyList();
        }

        @Override
        public void deleteByStrategy(String strategy) {
            logs.removeIf(l -> strategy.equals(l.getStrategy()));
        }

        @Override public void flush() {}
        @Override public <S extends ScanLogEntity> S saveAndFlush(S entity) { return save(entity); }
        @Override public <S extends ScanLogEntity> List<S> saveAllAndFlush(Iterable<S> entities) { return Collections.emptyList(); }
        @Override public void deleteAllInBatch(Iterable<ScanLogEntity> entities) {}
        @Override public void deleteAllByIdInBatch(Iterable<Long> longs) {}
        @Override public void deleteAllInBatch() {}
        @Override public ScanLogEntity getOne(Long aLong) { return null; }
        @Override public ScanLogEntity getById(Long aLong) { return null; }
        @Override public ScanLogEntity getReferenceById(Long aLong) { return null; }
        @Override public <S extends ScanLogEntity> Optional<S> findOne(Example<S> example) { return Optional.empty(); }
        @Override public <S extends ScanLogEntity> List<S> findAll(Example<S> example) { return Collections.emptyList(); }
        @Override public <S extends ScanLogEntity> List<S> findAll(Example<S> example, Sort sort) { return Collections.emptyList(); }
        @Override public <S extends ScanLogEntity> Page<S> findAll(Example<S> example, Pageable pageable) { return Page.empty(); }
        @Override public <S extends ScanLogEntity> long count(Example<S> example) { return 0; }
        @Override public <S extends ScanLogEntity> boolean exists(Example<S> example) { return false; }
        @Override public <S extends ScanLogEntity, R> R findBy(Example<S> example, Function<FluentQuery.FetchableFluentQuery<S>, R> queryFunction) { return null; }
        @Override public <S extends ScanLogEntity> List<S> saveAll(Iterable<S> entities) { return Collections.emptyList(); }
        @Override public Optional<ScanLogEntity> findById(Long aLong) { return Optional.empty(); }
        @Override public boolean existsById(Long aLong) { return false; }
        @Override public List<ScanLogEntity> findAll() { return new ArrayList<>(logs); }
        @Override public List<ScanLogEntity> findAllById(Iterable<Long> longs) { return Collections.emptyList(); }
        @Override public long count() { return logs.size(); }
        @Override public void deleteById(Long aLong) {}
        @Override public void delete(ScanLogEntity entity) { logs.remove(entity); }
        @Override public void deleteAllById(Iterable<? extends Long> longs) {}
        @Override public void deleteAll(Iterable<? extends ScanLogEntity> entities) {}
        @Override public void deleteAll() { logs.clear(); }
        @Override public List<ScanLogEntity> findAll(Sort sort) { return Collections.emptyList(); }
        @Override public Page<ScanLogEntity> findAll(Pageable pageable) { return Page.empty(); }
    };

    @BeforeEach
    public void setup() {
        environmentSimulator = new RfEnvironmentSimulator(20);
        receiver = new Receiver();
        smartMlScheduler = new SmartMlScheduler(new RestTemplate(), "http://localhost:5000");
        sequentialScheduler = new SequentialScheduler();
        randomScheduler = new RandomScheduler();

        simulationEngine = new SimulationEngine(
                environmentSimulator,
                receiver,
                smartMlScheduler,
                sequentialScheduler,
                randomScheduler,
                stubRepository,
                500
        );
        simulationEngine.init();
    }

    @Test
    public void testGroundTruthGeneration() {
        EnvironmentState state = environmentSimulator.generateGroundTruth(0);
        assertNotNull(state);
        assertEquals(20, state.getBands().length);
        // Fixed signal is on band 7
        assertEquals(1, state.getBands()[7], "Band 7 must have fixed signal");
    }

    @Test
    public void testReceiverHitAndMiss() {
        EnvironmentState state = environmentSimulator.generateGroundTruth(0);
        ScanResult hitResult = receiver.scan(7, state, "TEST");
        assertTrue(hitResult.isHit(), "Scanning band 7 should be a HIT");
        assertEquals(1, hitResult.getResult());

        // Band 0 has no signal in default scenario at t=0
        ScanResult missResult = receiver.scan(0, state, "TEST");
        assertFalse(missResult.isHit(), "Scanning band 0 should be a MISS");
        assertEquals(0, missResult.getResult());
    }

    @Test
    public void testSimulationStepExecution() {
        Map<String, Object> state = simulationEngine.step();
        assertNotNull(state);
        assertEquals(1L, state.get("time"));
        assertTrue(state.containsKey("bands"));
        assertTrue(state.containsKey("scannedBand"));
        assertTrue(state.containsKey("hit"));
        assertTrue(state.containsKey("comparison"));

        // Step 20 times to accumulate stats
        for (int i = 0; i < 20; i++) {
            simulationEngine.step();
        }

        SimulationStats mlStats = simulationEngine.getSmartMlStats();
        SimulationStats seqStats = simulationEngine.getSequentialStats();
        SimulationStats randStats = simulationEngine.getRandomStats();

        assertEquals(21, mlStats.getTotalScans());
        assertEquals(21, seqStats.getTotalScans());
        assertEquals(21, randStats.getTotalScans());

        assertTrue(mlStats.getDetectionRate() >= 0.0);
        assertTrue(seqStats.getDetectionRate() >= 0.0);
        assertTrue(randStats.getDetectionRate() >= 0.0);
    }
}
