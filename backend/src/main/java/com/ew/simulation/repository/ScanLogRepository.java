package com.ew.simulation.repository;

import com.ew.simulation.entity.ScanLogEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ScanLogRepository extends JpaRepository<ScanLogEntity, Long> {

    List<ScanLogEntity> findTop100ByStrategyOrderByTimeStepDesc(String strategy);

    long countByStrategy(String strategy);

    long countByStrategyAndResult(String strategy, int result);

    @Query("SELECT l FROM ScanLogEntity l WHERE l.strategy = :strategy ORDER BY l.timeStep DESC")
    List<ScanLogEntity> findRecentLogsByStrategy(@Param("strategy") String strategy, org.springframework.data.domain.Pageable pageable);

    void deleteByStrategy(String strategy);
}
