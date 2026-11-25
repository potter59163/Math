import type { SceneSpec } from '@/lib/topics/types';
import { CellByCell } from './CellByCell';
import { CellLocator } from './CellLocator';
import { DetSum } from './DetSum';
import { DimensionMatch } from './DimensionMatch';
import { GridTransform } from './GridTransform';
import { InverseRecipe } from './InverseRecipe';
import { RowColDot } from './RowColDot';
import { Sarrus } from './Sarrus';
import { TransposeFlip } from './TransposeFlip';
import { WorkedSolution } from './WorkedSolution';
import { AngleFan } from './vector/AngleFan';
import { AreaVolume } from './vector/AreaVolume';
import { ArrowChain } from './vector/ArrowChain';
import { ComponentSteps } from './vector/ComponentSteps';
import { CrossCover } from './vector/CrossCover';
import { DotPairs } from './vector/DotPairs';
import { MagnitudeBox } from './vector/MagnitudeBox';
import { ParallelScale } from './vector/ParallelScale';
import { QuantitySort } from './vector/QuantitySort';
import { UnitShrink } from './vector/UnitShrink';

/**
 * Pure on its spec and beat: the same two always draw the same frame (SCENES §2). The switch covers
 * every topic's templates, so a pack that adds one cannot compile until it has a case here.
 */
export function SceneStage({ spec, beat }: { spec: SceneSpec; beat: string }) {
  switch (spec.template) {
    case 'cell_by_cell':
      return <CellByCell spec={spec} beat={beat as (typeof spec.beats)[number]} />;
    case 'det_sum':
      return <DetSum spec={spec} beat={beat as (typeof spec.beats)[number]} />;
    case 'row_col_dot':
      return <RowColDot spec={spec} beat={beat as (typeof spec.beats)[number]} />;
    case 'dimension_match':
      return <DimensionMatch spec={spec} beat={beat as (typeof spec.beats)[number]} />;
    case 'grid_transform':
      return <GridTransform spec={spec} beat={beat as (typeof spec.beats)[number]} />;
    case 'inverse_recipe':
      return <InverseRecipe spec={spec} beat={beat as (typeof spec.beats)[number]} />;
    case 'worked_solution':
      return <WorkedSolution spec={spec} beat={beat as (typeof spec.beats)[number]} />;
    case 'cell_locator':
      return <CellLocator spec={spec} beat={beat as (typeof spec.beats)[number]} />;
    case 'transpose_flip':
      return <TransposeFlip spec={spec} beat={beat as (typeof spec.beats)[number]} />;
    case 'sarrus':
      return <Sarrus spec={spec} beat={beat as (typeof spec.beats)[number]} />;
    // Vectors (docs/VECTORS.md §5). Their reveal clips use the shared worked_solution above.
    case 'quantity_sort':
      return <QuantitySort spec={spec} beat={beat as (typeof spec.beats)[number]} />;
    case 'arrow_chain':
      return <ArrowChain spec={spec} beat={beat as (typeof spec.beats)[number]} />;
    case 'component_steps':
      return <ComponentSteps spec={spec} beat={beat as (typeof spec.beats)[number]} />;
    case 'parallel_scale':
      return <ParallelScale spec={spec} beat={beat as (typeof spec.beats)[number]} />;
    case 'magnitude_box':
      return <MagnitudeBox spec={spec} beat={beat as (typeof spec.beats)[number]} />;
    case 'unit_shrink':
      return <UnitShrink spec={spec} beat={beat as (typeof spec.beats)[number]} />;
    case 'dot_pairs':
      return <DotPairs spec={spec} beat={beat as (typeof spec.beats)[number]} />;
    case 'angle_fan':
      return <AngleFan spec={spec} beat={beat as (typeof spec.beats)[number]} />;
    case 'cross_cover':
      return <CrossCover spec={spec} beat={beat as (typeof spec.beats)[number]} />;
    case 'area_volume':
      return <AreaVolume spec={spec} beat={beat as (typeof spec.beats)[number]} />;
  }
}
