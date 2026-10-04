package com.ew.simulation.controller;

import com.ew.simulation.entity.ScanLogEntity;
import com.ew.simulation.model.SimulationStats;
import com.ew.simulation.repository.ScanLogRepository;
import com.ew.simulation.service.SimulationEngine;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@CrossOrigin(origins = "*")
public class SimulationController {

    private final SimulationEngine simulationEngine;
    private final ScanLogRepository scanLogRepository;

    public SimulationController(SimulationEngine simulationEngine, ScanLogRepository scanLogRepository) {
        this.simulationEngine = simulationEngine;
        this.scanLogRepository = scanLogRepository;
    }

    /**
     * Required API: GET /simulate/start -> start simulation
     */
    @GetMapping("/simulate/start")
    public ResponseEntity<Map<String, Object>> startSimulationGet(
            @RequestParam(required = false, defaultValue = "500") Integer speedMs) {
        simulationEngine.start(speedMs);
        Map<String, Object> resp = new HashMap<>();
        resp.put("status", "started");
        resp.put("running", true);
        resp.put("speedMs", speedMs);
        resp.put("time", simulationEngine.getCurrentTime());
        return ResponseEntity.ok(resp);
    }

    @PostMapping("/api/simulate/start")
    public ResponseEntity<Map<String, Object>> startSimulationPost(
            @RequestBody(required = false) Map<String, Object> body) {
        Integer speed = 500;
        if (body != null && body.containsKey("speedMs")) {
            speed = ((Number) body.get("speedMs")).intValue();
        }
        simulationEngine.start(speed);
        return ResponseEntity.ok(simulationEngine.getStateSnapshot());
    }

    /**
     * Required API: GET /simulate/step -> run one step
     */
    @GetMapping("/simulate/step")
    public ResponseEntity<Map<String, Object>> stepSimulationGet() {
        Map<String, Object> snapshot = simulationEngine.step();
        return ResponseEntity.ok(snapshot);
    }

    @PostMapping("/api/simulate/step")
    public ResponseEntity<Map<String, Object>> stepSimulationPost() {
        return ResponseEntity.ok(simulationEngine.step());
    }

    /**
     * Required API: GET /stats -> return detection rate, miss rate, avg intercept time
     */
    @GetMapping("/stats")
    public ResponseEntity<Map<String, Object>> getStatsGet(
            @RequestParam(required = false, defaultValue = "SMART_ML") String strategy) {
        SimulationStats stats = simulationEngine.getStatsForStrategy(strategy);
        Map<String, Object> resp = new HashMap<>();
        resp.put("strategy", stats.getStrategy());
        resp.put("detectionRate", Math.round(stats.getDetectionRate() * 1000.0) / 1000.0);
        resp.put("missRate", Math.round(stats.getMissRate() * 1000.0) / 1000.0);
        resp.put("avgInterceptTime", Math.round(stats.getAvgInterceptTime() * 100.0) / 100.0);
        resp.put("totalScans", stats.getTotalScans());
        resp.put("hits", stats.getHits());
        resp.put("misses", stats.getMisses());
        return ResponseEntity.ok(resp);
    }

    @GetMapping("/api/stats")
    public ResponseEntity<Map<String, Object>> getStatsApi() {
        return ResponseEntity.ok(simulationEngine.getStateSnapshot());
    }

    @GetMapping("/api/state")
    public ResponseEntity<Map<String, Object>> getState() {
        return ResponseEntity.ok(simulationEngine.getStateSnapshot());
    }

    @GetMapping(value = {"/simulate/pause", "/simulate/stop"})
    public ResponseEntity<Map<String, Object>> pauseSimulationGet() {
        simulationEngine.pause();
        Map<String, Object> resp = new HashMap<>();
        resp.put("status", "paused");
        resp.put("running", false);
        resp.put("time", simulationEngine.getCurrentTime());
        return ResponseEntity.ok(resp);
    }

    @PostMapping("/api/simulate/pause")
    public ResponseEntity<Map<String, Object>> pauseSimulationPost() {
        simulationEngine.pause();
        return ResponseEntity.ok(simulationEngine.getStateSnapshot());
    }

    @GetMapping("/simulate/reset")
    public ResponseEntity<Map<String, Object>> resetSimulationGet() {
        simulationEngine.reset();
        Map<String, Object> resp = new HashMap<>();
        resp.put("status", "reset");
        resp.put("time", 0);
        return ResponseEntity.ok(resp);
    }

    @PostMapping("/api/simulate/reset")
    public ResponseEntity<Map<String, Object>> resetSimulationPost() {
        simulationEngine.reset();
        return ResponseEntity.ok(simulationEngine.getStateSnapshot());
    }

    @GetMapping("/api/comparison")
    public ResponseEntity<Map<String, Object>> getComparison() {
        Map<String, Object> resp = new HashMap<>();
        resp.put("time", simulationEngine.getCurrentTime());
        resp.put("smart_ml", simulationEngine.getSmartMlStats());
        resp.put("sequential", simulationEngine.getSequentialStats());
        resp.put("random", simulationEngine.getRandomStats());
        return ResponseEntity.ok(resp);
    }

    @GetMapping("/api/logs")
    public ResponseEntity<List<ScanLogEntity>> getRecentLogs(
            @RequestParam(required = false, defaultValue = "SMART_ML") String strategy,
            @RequestParam(required = false, defaultValue = "50") int limit) {
        List<ScanLogEntity> logs = scanLogRepository.findRecentLogsByStrategy(
                strategy.toUpperCase(),
                PageRequest.of(0, Math.min(200, limit))
        );
        return ResponseEntity.ok(logs);
    }

    @PostMapping("/api/config/scenario")
    public ResponseEntity<Map<String, Object>> setScenario(@RequestBody Map<String, String> body) {
        String scenario = body.getOrDefault("scenario", "default").toLowerCase();
        if ("agile".equals(scenario)) {
            simulationEngine.getEnvironmentSimulator().loadAgileHopperScenario();
        } else if ("stealth".equals(scenario)) {
            simulationEngine.getEnvironmentSimulator().loadStealthScenario();
        } else {
            simulationEngine.getEnvironmentSimulator().loadDefaultScenario();
        }
        simulationEngine.reset();
        Map<String, Object> resp = new HashMap<>();
        resp.put("status", "scenario_loaded");
        resp.put("scenario", scenario);
        resp.put("emitters", simulationEngine.getEnvironmentSimulator().getEmitters());
        return ResponseEntity.ok(resp);
    }

    @PostMapping("/api/config/strategy")
    public ResponseEntity<Map<String, Object>> setStrategy(@RequestBody Map<String, String> body) {
        String strategy = body.getOrDefault("strategy", "SMART_ML").toUpperCase();
        simulationEngine.setPrimaryStrategy(strategy);
        Map<String, Object> resp = new HashMap<>();
        resp.put("status", "strategy_updated");
        resp.put("primaryStrategy", strategy);
        return ResponseEntity.ok(resp);
    }

    @PostMapping("/api/config/speed")
    public ResponseEntity<Map<String, Object>> setSpeed(@RequestBody Map<String, Integer> body) {
        int speed = body.getOrDefault("speedMs", 500);
        simulationEngine.setTickIntervalMs(speed);
        Map<String, Object> resp = new HashMap<>();
        resp.put("status", "speed_updated");
        resp.put("speedMs", speed);
        return ResponseEntity.ok(resp);
    }

    @PostMapping("/api/simulate/inject")
    public ResponseEntity<Map<String, Object>> injectSignal(@RequestBody Map<String, Integer> body) {
        int band = body.getOrDefault("band", 0);
        int duration = body.getOrDefault("duration", 4);
        simulationEngine.getEnvironmentSimulator().injectBurst(band, duration);
        Map<String, Object> resp = new HashMap<>();
        resp.put("status", "signal_injected");
        resp.put("band", band);
        resp.put("duration", duration);
        return ResponseEntity.ok(resp);
    }

    @GetMapping("/api/emitters")
    public ResponseEntity<Map<String, Object>> getEmitters() {
        Map<String, Object> resp = new HashMap<>();
        resp.put("numBands", simulationEngine.getEnvironmentSimulator().getNumBands());
        resp.put("emitters", simulationEngine.getEnvironmentSimulator().getEmitters());
        return ResponseEntity.ok(resp);
    }
}
